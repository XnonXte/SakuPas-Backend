import { createHash, timingSafeEqual } from "node:crypto";
import { pool } from "../config/database.js";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(stored, provided) {
  const left = Buffer.from(stored);
  const right = Buffer.from(hashToken(provided));
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function authenticate(request, response, next) {
  const bearer = request.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!bearer) {
    return response.status(401).json({ message: "Unauthenticated." });
  }

  try {
    const separator = bearer.indexOf("|");
    const tokenId = separator > 0 ? bearer.slice(0, separator) : null;
    const secret = tokenId ? bearer.slice(separator + 1) : bearer;
    const values = [hashToken(secret)];
    let tokenQuery = `
      SELECT id, tokenable_id, tokenable_type, token, expires_at, created_at
      FROM personal_access_tokens
      WHERE token = $1
    `;

    if (tokenId && /^\d+$/.test(tokenId)) {
      values.unshift(Number(tokenId));
      tokenQuery = `
        SELECT id, tokenable_id, tokenable_type, token, expires_at, created_at
        FROM personal_access_tokens
        WHERE id = $1 AND token = $2
      `;
    }

    const tokenResult = await pool.query(tokenQuery, values);
    const accessToken = tokenResult.rows[0];

    if (!accessToken || !tokenMatches(accessToken.token, secret)) {
      return response.status(401).json({ message: "Unauthenticated." });
    }

    const expirationMinutes = Number(process.env.TOKEN_EXPIRATION_MINUTES || 0);
    const isExpired = accessToken.expires_at && new Date(accessToken.expires_at) <= new Date();
    const hasExceededLifetime = expirationMinutes > 0
      && new Date(accessToken.created_at).getTime() <= Date.now() - expirationMinutes * 60_000;

    if (isExpired || hasExceededLifetime || accessToken.tokenable_type !== "App\\Models\\User") {
      return response.status(401).json({ message: "Unauthenticated." });
    }

    const userResult = await pool.query(
      "SELECT id, name, email FROM users WHERE id = $1",
      [accessToken.tokenable_id],
    );

    if (!userResult.rows[0]) {
      return response.status(401).json({ message: "Unauthenticated." });
    }

    request.user = userResult.rows[0];
    request.accessToken = accessToken;

    await pool.query(
      `UPDATE personal_access_tokens
       SET last_used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [accessToken.id],
    );

    return next();
  } catch (error) {
    return next(error);
  }
}
