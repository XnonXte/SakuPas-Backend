import { pool } from "../config/database.js";
import { dateIso, dateOnly, monthRange, todayUtc } from "../utils/dates.js";
import { getSettings, restrictionsPayload } from "./modeHematService.js";

const brandColors = ["#E9896A", "#387C6D", "#343F56", "#747B83", "#d68f77", "#599587"];

function rounded(value) {
  return Math.round(Number(value) || 0);
}

async function accountBalance(userId) {
  const result = await pool.query(
    "SELECT COALESCE(SUM(balance), 0)::bigint AS total FROM accounts WHERE user_id = $1",
    [userId],
  );
  return Number(result.rows[0].total);
}

async function safeToSpend(userId, now = new Date()) {
  const today = todayUtc();
  const range = monthRange(now.getUTCMonth() + 1, now.getUTCFullYear());
  const [balance, bills, expenses, income, budgets] = await Promise.all([
    accountBalance(userId),
    pool.query(
      `SELECT total_amount, paid_amount FROM pay_later_bills
       WHERE user_id = $1 AND status <> 'paid' AND due_date BETWEEN $2::date AND $3::date`,
      [userId, range.start, range.end],
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND transaction_date BETWEEN $2::date AND $3::date`,
      [userId, range.start, range.end],
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM transactions
       WHERE user_id = $1 AND type = 'income' AND transaction_date BETWEEN $2::date AND $3::date`,
      [userId, range.start, range.end],
    ),
    pool.query(
      "SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM budgets WHERE user_id = $1 AND month = $2 AND year = $3",
      [userId, range.month, range.year],
    ),
  ]);
  const unpaidPayLaterDue = bills.rows.reduce(
    (sum, bill) => sum + Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount)),
    0,
  );
  const currentMonthExpenses = Number(expenses.rows[0].total);
  const currentMonthIncome = Number(income.rows[0].total);
  const configuredBudget = Number(budgets.rows[0].total);
  const totalBudget = configuredBudget > 0 ? configuredBudget : 1_180_000;
  const discretionaryCapacity = Math.max(0, balance - unpaidPayLaterDue);
  const remainingBudgetCapacity = Math.max(0, totalBudget - currentMonthExpenses);
  const remainingAmount = balance <= 0 ? 0 : Math.min(discretionaryCapacity, remainingBudgetCapacity);
  const percentage = totalBudget > 0 ? Math.min(100, Math.max(0, rounded((remainingAmount / totalBudget) * 100))) : 0;
  let status;
  let statusLabel;

  if (percentage < 30 || remainingAmount < 250_000) [status, statusLabel] = ["danger", "Batas Bahaya"];
  else if (percentage < 60 || remainingAmount < 500_000) [status, statusLabel] = ["warning", "Perlu Berhati-hati"];
  else [status, statusLabel] = ["safe", "Kondisi Aman"];

  const daysInMonth = range.days;
  const day = Number(today.slice(8, 10));
  const daysRemaining = Math.max(1, daysInMonth - day + 1);

  return {
    remaining_amount: remainingAmount,
    total_budget: totalBudget,
    percentage,
    status,
    status_label: statusLabel,
    daily_safe_spend: rounded(remainingAmount / daysRemaining),
    days_remaining: daysRemaining,
    total_liquid_balance: balance,
    unpaid_paylater_due: unpaidPayLaterDue,
    current_month_expenses: currentMonthExpenses,
    current_month_income: currentMonthIncome,
  };
}

export async function getDashboardSummary(userId) {
  const range = monthRange();
  const [
    balance,
    bills,
    income,
    expense,
    count,
    safe,
    recent,
    upcoming,
    setting,
  ] = await Promise.all([
    accountBalance(userId),
    pool.query(
      `SELECT * FROM pay_later_bills
       WHERE user_id = $1 AND status <> 'paid' ORDER BY due_date ASC`,
      [userId],
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM transactions
       WHERE user_id = $1 AND type = 'income' AND transaction_date BETWEEN $2::date AND $3::date`,
      [userId, range.start, range.end],
    ),
    pool.query(
      `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND transaction_date BETWEEN $2::date AND $3::date`,
      [userId, range.start, range.end],
    ),
    pool.query(
      `SELECT count(*)::int AS total FROM transactions
       WHERE user_id = $1 AND transaction_date BETWEEN $2::date AND $3::date`,
      [userId, range.start, range.end],
    ),
    safeToSpend(userId),
    pool.query(
      `SELECT t.*, row_to_json(a) AS account, row_to_json(c) AS category
       FROM transactions t
       LEFT JOIN accounts a ON a.id = t.account_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1
       ORDER BY t.transaction_date DESC, t.id DESC LIMIT 5`,
      [userId],
    ),
    pool.query(
      `SELECT * FROM pay_later_bills WHERE user_id = $1 ORDER BY due_date ASC LIMIT 5`,
      [userId],
    ),
    getSettings(userId),
  ]);
  const outstanding = bills.rows.map((bill) => ({
    ...bill,
    outstanding_amount: Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount)),
  }));
  const nearest = outstanding[0];
  const mode = restrictionsPayload(setting);

  return {
    financial_summary: {
      main_balance: balance,
      total_paylater: outstanding.reduce((sum, bill) => sum + bill.outstanding_amount, 0),
      upcoming_bill_amount: nearest?.outstanding_amount || 0,
      monthly_income: Number(income.rows[0].total),
      monthly_expenses: Number(expense.rows[0].total),
      transaction_count: count.rows[0].total,
    },
    safe_to_spend: safe,
    recent_transactions: recent.rows,
    upcoming_bills: upcoming.rows.map((bill) => ({
      ...bill,
      outstanding_amount: Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount)),
      computed_status: Number(bill.paid_amount) >= Number(bill.total_amount)
        ? "paid"
        : dateOnly(bill.due_date) < todayUtc() ? "overdue"
          : Number(bill.paid_amount) > 0 ? "partially_paid" : "pending",
      days_remaining: Math.trunc((Date.parse(`${dateOnly(bill.due_date)}T00:00:00Z`) - Date.parse(`${todayUtc()}T00:00:00Z`)) / 86_400_000),
    })),
    mode_hemat: {
      is_active: mode.is_active,
      activated_at: dateIso(setting.activated_at),
    },
  };
}

export async function getCashFlow(userId, month, year) {
  const range = monthRange(month, year);
  const [transactions, balance] = await Promise.all([
    pool.query(
      `SELECT type, amount, transaction_date FROM transactions
       WHERE user_id = $1 AND transaction_date BETWEEN $2::date AND $3::date
       ORDER BY transaction_date ASC`,
      [userId, range.start, range.end],
    ),
    accountBalance(userId),
  ]);

  const daysPoints = [1, 5, 8, 11, 15, 20, 25, range.days];
  const step = Math.max(1, Math.ceil(range.days / 8));

  return daysPoints.map((dayNumber) => {
    const date = new Date(Date.UTC(range.year, range.month - 1, Math.min(dayNumber, range.days)));
    const dateString = dateOnly(date);
    const relevant = transactions.rows.filter((transaction) => {
      const day = Number(dateOnly(transaction.transaction_date).slice(8, 10));
      return day <= dayNumber && day > dayNumber - step;
    });
    const pemasukan = relevant
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);
    const pengeluaran = relevant
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0);

    return {
      day: `${String(date.getUTCDate()).padStart(2, "0")} ${new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(date)}`,
      day_number: date.getUTCDate(),
      date: dateString,
      pemasukan,
      pengeluaran,
      saldo_proyeksi: Math.max(0, balance - pengeluaran + pemasukan),
    };
  });
}

export async function getExpenseDistribution(userId, month, year) {
  const range = monthRange(month, year);
  const result = await pool.query(
    `SELECT t.category_id, SUM(t.amount)::bigint AS total_amount,
            c.name AS category_name, c.slug AS category_slug, c.color AS category_color
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1 AND t.type = 'expense'
       AND t.transaction_date BETWEEN $2::date AND $3::date
     GROUP BY t.category_id, c.name, c.slug, c.color
     ORDER BY t.category_id ASC`,
    [userId, range.start, range.end],
  );
  const totalExpense = result.rows.reduce((sum, row) => sum + Number(row.total_amount), 0);
  const items = result.rows
    .map((row, index) => {
      const amount = Number(row.total_amount);
      return {
        category_id: row.category_id,
        category_name: row.category_name ?? "Lain-lain",
        category_slug: row.category_slug ?? "other",
        amount,
        percentage: totalExpense > 0 ? rounded((amount / totalExpense) * 100) : 0,
        color: row.category_color ?? brandColors[index % brandColors.length],
      };
    })
    .sort((left, right) => right.amount - left.amount);

  return { total_expense: totalExpense, items };
}

export { safeToSpend };
