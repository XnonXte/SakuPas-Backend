import { pool, inTransaction } from "../config/database.js";
import { ApiError, notFound, validationError } from "../utils/errors.js";
import { fetchTransaction, findOwned, validId } from "../models/index.js";
import { requireAccount } from "./accountService.js";
import { requireCategory } from "./categoryService.js";
import { dateOnly } from "../utils/dates.js";

export async function listTransactions(userId, filters) {
  const clauses = ["t.user_id = $1"];
  const values = [userId];
  const add = (clause, value) => {
    values.push(value);
    clauses.push(clause.replace("?", `$${values.length}`));
  };

  if (filters.search) {
    const search = `%${String(filters.search).toLowerCase()}%`;
    values.push(search);
    const parameter = `$${values.length}`;
    clauses.push(`(
      LOWER(t.description) LIKE ${parameter}
      OR LOWER(t.payment_method) LIKE ${parameter}
      OR LOWER(c.name) LIKE ${parameter}
    )`);
  }

  if (filters.category_id && filters.category_id !== "all") {
    if (/^\d+$/.test(String(filters.category_id))) {
      add("t.category_id = ?", Number(filters.category_id));
    } else {
      clauses.push("FALSE");
    }
  } else if (filters.category_slug && filters.category_slug !== "all") {
    add("c.slug = ?", filters.category_slug);
  }
  if (["income", "expense"].includes(filters.type)) add("t.type = ?", filters.type);
  if (filters.month && filters.month !== "all") add("to_char(t.transaction_date, 'YYYY-MM') = ?", filters.month);
  const validDateFilter = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (filters.start_date) {
    if (validDateFilter(filters.start_date)) add("t.transaction_date >= ?::date", filters.start_date);
    else clauses.push("FALSE");
  }
  if (filters.end_date) {
    if (validDateFilter(filters.end_date)) add("t.transaction_date <= ?::date", filters.end_date);
    else clauses.push("FALSE");
  }

  const parsedPerPage = Number.parseInt(filters.per_page, 10);
  const parsedPage = Number.parseInt(filters.page, 10);
  const perPage = Number.isSafeInteger(parsedPerPage) && parsedPerPage > 0 ? parsedPerPage : 50;
  const currentPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (currentPage - 1) * perPage;
  const where = clauses.join(" AND ");

  const count = await pool.query(
    `SELECT count(*)::int AS total
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${where}`,
    values,
  );
  const total = count.rows[0].total;
  const pageValues = [...values, perPage, offset];
  const items = await pool.query(
    `SELECT t.*, row_to_json(a) AS account, row_to_json(c) AS category
     FROM transactions t
     LEFT JOIN accounts a ON a.id = t.account_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE ${where}
     ORDER BY t.transaction_date DESC, t.id DESC
     LIMIT $${pageValues.length - 1} OFFSET $${pageValues.length}`,
    pageValues,
  );

  return {
    items: items.rows,
    pagination: {
      current_page: currentPage,
      last_page: Math.max(1, Math.ceil(total / perPage)),
      per_page: perPage,
      total,
    },
  };
}

export async function getTransaction(id, userId) {
  if (!validId(id)) notFound();
  const transaction = await fetchTransaction(pool, Number(id));
  if (!transaction) notFound();
  if (Number(transaction.user_id) !== Number(userId)) {
    throw new ApiError(403, "Anda tidak memiliki akses ke transaksi ini.");
  }
  return transaction;
}

export async function createTransaction(user, data) {
  return inTransaction(async (client) => {
    const [account, category] = await Promise.all([
      requireAccount(data.account_id, user.id, client),
      requireCategory(data.category_id, user.id, client),
    ]);

    const result = await client.query(
      `INSERT INTO transactions
        (user_id, account_id, category_id, type, amount, description, transaction_date, payment_method, notes,
         created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        user.id, account.id, category.id, data.type, Number(data.amount),
        data.description, dateOnly(data.transaction_date),
        data.payment_method ?? account.name, data.notes ?? null,
      ],
    );

    const delta = data.type === "income" ? Number(data.amount) : -Number(data.amount);
    await client.query(
      "UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [delta, account.id],
    );
    return fetchTransaction(client, result.rows[0].id);
  });
}

export async function updateTransaction(id, userId, data) {
  return inTransaction(async (client) => {
    const { record: previous, forbidden } = await findOwned("transactions", id, userId, client);
    if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke transaksi ini.");

    const originalAccount = await requireAccount(previous.account_id, userId, client);
    const targetAccount = await requireAccount(data.account_id, userId, client);
    const category = await requireCategory(data.category_id, userId, client);

    const oldDelta = previous.type === "income" ? -Number(previous.amount) : Number(previous.amount);
    const newDelta = data.type === "income" ? Number(data.amount) : -Number(data.amount);

    await client.query(
      "UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [oldDelta, originalAccount.id],
    );
    await client.query(
      "UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [newDelta, targetAccount.id],
    );

    await client.query(
      `UPDATE transactions
       SET account_id = $1, category_id = $2, type = $3, amount = $4,
           description = $5, transaction_date = $6, payment_method = $7,
           notes = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9`,
      [
        targetAccount.id, category.id, data.type, Number(data.amount),
        data.description, dateOnly(data.transaction_date),
        data.payment_method ?? previous.payment_method,
        data.notes ?? previous.notes, previous.id,
      ],
    );

    return fetchTransaction(client, previous.id);
  });
}

export async function deleteTransaction(id, userId) {
  return inTransaction(async (client) => {
    const { record: transaction, forbidden } = await findOwned("transactions", id, userId, client);
    if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke transaksi ini.");

    const result = await client.query(
      "SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [transaction.account_id, userId],
    );
    const account = result.rows[0];
    if (account) {
      const delta = transaction.type === "income" ? -Number(transaction.amount) : Number(transaction.amount);
      await client.query(
        "UPDATE accounts SET balance = balance + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [delta, account.id],
      );
    }

    await client.query("DELETE FROM transactions WHERE id = $1", [transaction.id]);
  });
}
