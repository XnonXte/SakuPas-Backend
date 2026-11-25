import { pool, inTransaction } from "../config/database.js";
import { ApiError, notFound, validationError } from "../utils/errors.js";
import { findOwned, validId } from "../models/index.js";

export async function listAccounts(userId) {
  const result = await pool.query(
    "SELECT * FROM accounts WHERE user_id = $1 ORDER BY id ASC",
    [userId],
  );
  return result.rows;
}

export async function createAccount(userId, data) {
  const result = await pool.query(
    `INSERT INTO accounts (user_id, name, account_type, balance, description, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
    [userId, data.name, data.account_type, Number(data.balance), data.description ?? null],
  );
  return result.rows[0];
}

export async function getOwnedAccount(id, userId) {
  const { record, forbidden } = await findOwned("accounts", id, userId);
  if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke rekening ini.");
  return record;
}

export async function updateAccount(id, userId, data) {
  return inTransaction(async (client) => {
    const { record, forbidden } = await findOwned("accounts", id, userId, client);
    if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke rekening ini.");

    const result = await client.query(
      `UPDATE accounts
       SET name = $1, account_type = $2, balance = $3, description = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 RETURNING *`,
      [
        data.name,
        data.account_type,
        Number(data.balance),
        data.description === undefined ? record.description : data.description,
        record.id,
      ],
    );
    return result.rows[0];
  });
}

export async function deleteAccount(id, userId) {
  return inTransaction(async (client) => {
    const { record, forbidden } = await findOwned("accounts", id, userId, client);
    if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke rekening ini.");

    const transactions = await client.query(
      "SELECT count(*)::int AS count FROM transactions WHERE account_id = $1",
      [record.id],
    );
    if (transactions.rows[0].count > 0) {
      throw new ApiError(422, "Rekening tidak dapat dihapus karena masih memiliki riwayat transaksi terkait.");
    }

    await client.query("DELETE FROM accounts WHERE id = $1", [record.id]);
  });
}

export async function requireAccount(id, userId, client = pool, invalidIsValidation = true) {
  if (!validId(id)) {
    if (invalidIsValidation) validationError({ account_id: ["The selected account_id is invalid."] });
    notFound();
  }
  const result = await client.query(
    "SELECT * FROM accounts WHERE id = $1 FOR UPDATE",
    [Number(id)],
  );
  const account = result.rows[0];
  if (!account) {
    if (invalidIsValidation) validationError({ account_id: ["The selected account_id is invalid."] });
    notFound();
  }
  if (Number(account.user_id) !== Number(userId)) notFound();
  return account;
}
