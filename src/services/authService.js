import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool, inTransaction } from "../config/database.js";
import { ApiError, validationError } from "../utils/errors.js";

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

function matchesExistingBcryptHash(password, storedHash) {
  const compatibleHash = storedHash.replace(/^\$2y\$/, "$2b$");
  return bcrypt.compare(password, compatibleHash);
}

export async function register(data) {
  const duplicate = await pool.query("SELECT 1 FROM users WHERE email = $1", [data.email]);
  if (duplicate.rowCount) validationError({ email: ["Email sudah terdaftar."] });

  const password = await hashPassword(data.password);
  return inTransaction(async (client) => {
    const userResult = await client.query(
      `INSERT INTO users (name, email, password, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email`,
      [data.name, data.email, password],
    );
    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO accounts
        (user_id, name, account_type, balance, description, created_at, updated_at)
       VALUES ($1, 'Rekening Utama', 'bank', 0, 'Rekening utama', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [user.id],
    );
    await client.query(
      `INSERT INTO self_lock_settings
        (user_id, is_active, lifestyle_budget_cap, hide_shopping_recommendations, created_at, updated_at)
       VALUES ($1, false, 100000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [user.id],
    );
    const token = await createToken(client, user.id);

    return { user, token };
  });
}

export async function login(data) {
  const result = await pool.query(
    "SELECT id, name, email, password FROM users WHERE email = $1",
    [data.email],
  );
  const user = result.rows[0];

  if (!user || !(await matchesExistingBcryptHash(data.password, user.password))) {
    validationError({ email: ["Kombinasi email dan password tidak sesuai."] });
  }

  const token = await createToken(pool, user.id);
  return {
    user: { id: user.id, name: user.name, email: user.email },
    token,
  };
}

export async function createToken(client, userId) {
  const secret = randomBytes(40).toString("hex");
  const hash = createHash("sha256").update(secret).digest("hex");
  const result = await client.query(
    `INSERT INTO personal_access_tokens
      (tokenable_type, tokenable_id, name, token, abilities, created_at, updated_at)
     VALUES ('App\\Models\\User', $1, 'auth_token', $2, '["*"]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING id`,
    [userId, hash],
  );

  return `${result.rows[0].id}|${secret}`;
}

export async function logout(tokenId, userId) {
  const result = await pool.query(
    `DELETE FROM personal_access_tokens
     WHERE id = $1 AND tokenable_id = $2 AND tokenable_type = 'App\\Models\\User'`,
    [tokenId, userId],
  );
  if (!result.rowCount) throw new ApiError(401, "Unauthenticated.");
}

export async function getProfile(userId) {
  const [accounts, settingResult] = await Promise.all([
    pool.query("SELECT * FROM accounts WHERE user_id = $1 ORDER BY id ASC", [userId]),
    pool.query("SELECT is_active FROM self_lock_settings WHERE user_id = $1", [userId]),
  ]);
  return {
    accounts: accounts.rows,
    mode_hemat_active: Boolean(settingResult.rows[0]?.is_active),
  };
}

export async function updateProfile(userId, data) {
  const duplicate = await pool.query(
    "SELECT 1 FROM users WHERE email = $1 AND id <> $2",
    [data.email, userId],
  );
  if (duplicate.rowCount) validationError({ email: ["The email has already been taken."] });

  const result = await pool.query(
    `UPDATE users SET name = $1, email = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 RETURNING id, name, email`,
    [data.name, data.email, userId],
  );
  return result.rows[0];
}

export function unauthorized() {
  throw new ApiError(401, "Unauthenticated.");
}
