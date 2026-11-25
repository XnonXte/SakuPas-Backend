import { pool } from "../config/database.js";
import { notFound } from "../utils/errors.js";

export function validId(value) {
  return /^\d+$/.test(String(value)) && Number(value) > 0;
}

export async function findOwned(table, id, userId, client = pool) {
  if (!validId(id)) notFound();

  const result = await client.query(
    `SELECT * FROM ${table} WHERE id = $1`,
    [Number(id)],
  );
  const record = result.rows[0];
  if (!record) notFound();
  if (Number(record.user_id) !== Number(userId)) {
    return { record, forbidden: true };
  }

  return { record, forbidden: false };
}

export async function fetchTransaction(client, id) {
  const result = await client.query(
    `SELECT t.*, row_to_json(a) AS account, row_to_json(c) AS category
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.id = $1`,
    [id],
  );

  return result.rows[0];
}

export async function fetchBill(client, id) {
  const result = await client.query(
    "SELECT * FROM pay_later_bills WHERE id = $1",
    [id],
  );
  return result.rows[0];
}
