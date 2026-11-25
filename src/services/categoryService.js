import { pool } from "../config/database.js";
import { ApiError, notFound, validationError } from "../utils/errors.js";
import { validId } from "../models/index.js";
import { slugify } from "../utils/slug.js";

export async function listCategories(userId) {
  const result = await pool.query(
    `SELECT * FROM categories
     WHERE user_id IS NULL OR user_id = $1
     ORDER BY is_system DESC, name ASC`,
    [userId],
  );
  return result.rows;
}

export async function createCategory(userId, data) {
  const result = await pool.query(
    `INSERT INTO categories
      (user_id, name, slug, type, sublabel, icon, color, is_system, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      userId,
      data.name,
      slugify(data.name),
      data.type,
      data.sublabel ?? null,
      data.icon ?? "CircleDot",
      data.color ?? "#343F56",
    ],
  );
  return result.rows[0];
}

export async function deleteCategory(id, userId) {
  if (!validId(id)) notFound();
  const result = await pool.query("SELECT * FROM categories WHERE id = $1", [Number(id)]);
  const category = result.rows[0];

  if (!category) notFound();
  if (category.is_system || Number(category.user_id) !== Number(userId)) {
    throw new ApiError(403, "Kategori sistem tidak dapat dihapus.");
  }

  const transactions = await pool.query(
    "SELECT count(*)::int AS count FROM transactions WHERE category_id = $1",
    [category.id],
  );
  if (transactions.rows[0].count > 0) {
    throw new ApiError(422, "Kategori tidak dapat dihapus karena masih digunakan dalam riwayat transaksi.");
  }

  await pool.query("DELETE FROM categories WHERE id = $1", [category.id]);
}

export async function requireCategory(id, userId, client = pool) {
  if (!validId(id)) validationError({ category_id: ["The selected category_id is invalid."] });
  const result = await client.query(
    "SELECT * FROM categories WHERE id = $1",
    [Number(id)],
  );
  const category = result.rows[0];
  if (!category) validationError({ category_id: ["The selected category_id is invalid."] });
  if (category.user_id !== null && Number(category.user_id) !== Number(userId)) notFound();
  return category;
}
