import { pool, inTransaction } from "../config/database.js";
import { ApiError, notFound, validationError } from "../utils/errors.js";
import { findOwned, validId } from "../models/index.js";
import { monthRange } from "../utils/dates.js";

export async function listBudgets(userId, month, year) {
  const range = monthRange(month, year);
  const [budgets, expenses] = await Promise.all([
    pool.query(
      `SELECT b.*, c.name AS category_name, c.slug AS category_slug,
              c.icon AS category_icon, c.color AS category_color,
              c.sublabel AS category_sublabel
       FROM budgets b
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = $1 AND b.month = $2 AND b.year = $3`,
      [userId, range.month, range.year],
    ),
    pool.query(
      `SELECT category_id, SUM(amount)::bigint AS total_spent
       FROM transactions
       WHERE user_id = $1 AND type = 'expense'
         AND transaction_date BETWEEN $2::date AND $3::date
       GROUP BY category_id`,
      [userId, range.start, range.end],
    ),
  ]);
  const spentByCategory = new Map(expenses.rows.map((row) => [row.category_id, Number(row.total_spent)]));
  const totalAllocated = budgets.rows.reduce((sum, budget) => sum + Number(budget.amount), 0);

  return budgets.rows.map((budget) => {
    const allocated = Number(budget.amount);
    const spent = spentByCategory.get(budget.category_id) || 0;
    const percentUsed = allocated > 0 ? Math.min(999, Math.round((spent / allocated) * 100)) : 0;
    let status;
    let statusLabel;

    if (spent > allocated) [status, statusLabel] = ["exceeded", "Melebihi Batas"];
    else if (percentUsed >= 70) [status, statusLabel] = ["warning", "Mendekati Batas"];
    else [status, statusLabel] = ["safe", "Aman"];

    return {
      id: budget.id,
      category_id: budget.category_id,
      category_name: budget.category_name ?? "Kategori",
      category_slug: budget.category_slug ?? "",
      category_icon: budget.category_icon ?? "CircleDot",
      category_color: budget.category_color ?? "#343F56",
      category_sublabel: budget.category_sublabel ?? "",
      allocated,
      spent,
      remaining: Math.max(0, allocated - spent),
      percent_used: percentUsed,
      percent_of_total: totalAllocated > 0 ? Math.round((allocated / totalAllocated) * 100) : 0,
      status,
      status_label: statusLabel,
      month: budget.month,
      year: budget.year,
    };
  });
}

export async function saveBudget(userId, data) {
  const categoryId = Number(data.category_id);
  const categoryResult = await pool.query("SELECT * FROM categories WHERE id = $1", [categoryId]);
  const category = categoryResult.rows[0];
  if (!category) validationError({ category_id: ["The selected category_id is invalid."] });

  const now = new Date();
  const month = data.month ? Number(data.month) : now.getUTCMonth() + 1;
  const year = data.year ? Number(data.year) : now.getUTCFullYear();

  const settingResult = await pool.query(
    "SELECT is_active, lifestyle_budget_cap FROM self_lock_settings WHERE user_id = $1",
    [userId],
  );
  const setting = settingResult.rows[0];
  if (setting?.is_active && category.slug === "lifestyle" && Number(data.amount) > Number(setting.lifestyle_budget_cap)) {
    const cap = Number(setting.lifestyle_budget_cap).toLocaleString("id-ID");
    validationError({
      amount: [`Mode Hemat aktif: Alokasi kategori lifestyle dibatasi maksimal Rp${cap} demi menjaga sisa uang saku.`],
    });
  }

  const result = await pool.query(
    `INSERT INTO budgets (user_id, category_id, amount, month, year, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, category_id, month, year)
     DO UPDATE SET amount = EXCLUDED.amount, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, categoryId, Number(data.amount), month, year],
  );
  const budget = result.rows[0];
  budget.category = category;
  return budget;
}

export async function deleteBudget(id, userId) {
  if (!validId(id)) notFound();
  const { record, forbidden } = await findOwned("budgets", id, userId);
  if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke budget ini.");
  await pool.query("DELETE FROM budgets WHERE id = $1", [record.id]);
}

export function ensureCategoryExists(id) {
  if (!validId(id)) notFound();
}
