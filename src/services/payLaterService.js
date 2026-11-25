import { pool, inTransaction } from "../config/database.js";
import { ApiError, notFound, validationError } from "../utils/errors.js";
import { findOwned, validId } from "../models/index.js";
import { dateDaysBetween, dateOnly, todayUtc } from "../utils/dates.js";
import { requireAccount } from "./accountService.js";

function billWithComputedFields(bill, repayments = undefined) {
  const total = Number(bill.total_amount);
  const paid = Number(bill.paid_amount);
  const outstanding = Math.max(0, total - paid);
  const today = todayUtc();
  let computedStatus;

  if (paid >= total) computedStatus = "paid";
  else if (today > dateOnly(bill.due_date)) computedStatus = "overdue";
  else if (paid > 0) computedStatus = "partially_paid";
  else computedStatus = "pending";

  return {
    ...bill,
    total_amount: total,
    paid_amount: paid,
    due_date: bill.due_date,
    outstanding_amount: outstanding,
    computed_status: computedStatus,
    days_remaining: dateDaysBetween(today, bill.due_date),
    ...(repayments !== undefined ? { repayments } : {}),
  };
}

async function getRepayments(client, billId, withAccounts = false) {
  const result = await client.query(
    `SELECT r.*${withAccounts ? ", row_to_json(a) AS account" : ""}
     FROM pay_later_repayments r
     ${withAccounts ? "LEFT JOIN accounts a ON a.id = r.account_id" : ""}
     WHERE r.pay_later_bill_id = $1
     ORDER BY r.repayment_date DESC`,
    [billId],
  );
  return result.rows;
}

async function synchronizeBillStatus(client, bill) {
  const computed = billWithComputedFields(bill).computed_status;
  if (bill.status !== computed) {
    await client.query(
      "UPDATE pay_later_bills SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [computed, bill.id],
    );
    bill.status = computed;
  }
}

export async function listBills(userId) {
  const result = await pool.query(
    "SELECT * FROM pay_later_bills WHERE user_id = $1 ORDER BY due_date ASC",
    [userId],
  );
  const bills = result.rows;
  for (const bill of bills) {
    await synchronizeBillStatus(pool, bill);
  }
  if (!bills.length) return [];

  const repaymentResult = await pool.query(
    `SELECT * FROM pay_later_repayments
     WHERE pay_later_bill_id = ANY($1::bigint[])
     ORDER BY repayment_date DESC`,
    [bills.map((bill) => bill.id)],
  );
  const repaymentsByBill = new Map(bills.map((bill) => [bill.id, []]));
  for (const repayment of repaymentResult.rows) {
    repaymentsByBill.get(repayment.pay_later_bill_id)?.push(repayment);
  }
  return bills.map((bill) => billWithComputedFields(bill, repaymentsByBill.get(bill.id)));
}

export async function getBill(id, userId, includeRepayments = false) {
  if (!validId(id)) notFound();
  const result = await pool.query("SELECT * FROM pay_later_bills WHERE id = $1", [Number(id)]);
  const bill = result.rows[0];
  if (!bill) notFound();
  if (Number(bill.user_id) !== Number(userId)) {
    throw new ApiError(403, "Anda tidak memiliki akses ke tagihan ini.");
  }
  if (!includeRepayments) return billWithComputedFields(bill);

  const repayments = await getRepayments(pool, bill.id, true);
  for (const repayment of repayments) {
    if (repayment.account?.balance !== undefined) repayment.account.balance = Number(repayment.account.balance);
  }
  return billWithComputedFields(bill, repayments);
}

export async function createBill(userId, data) {
  const dueDate = dateOnly(data.due_date);
  const status = dueDate <= todayUtc() ? "overdue" : "pending";
  const result = await pool.query(
    `INSERT INTO pay_later_bills
      (user_id, provider_name, description, total_amount, paid_amount, due_date, status, installment_info,
       created_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     RETURNING *`,
    [
      userId, data.provider_name, data.description ?? null, Number(data.total_amount),
      dueDate, status, data.installment_info ?? null,
    ],
  );
  return billWithComputedFields(result.rows[0]);
}

export async function updateBill(id, userId, data) {
  return inTransaction(async (client) => {
    const { record: bill, forbidden } = await findOwned("pay_later_bills", id, userId, client);
    if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke tagihan ini.");
    const total = data.total_amount === undefined ? Number(bill.total_amount) : Number(data.total_amount);

    if (total < Number(bill.paid_amount)) {
      validationError({ total_amount: ["Total tagihan tidak boleh lebih kecil dari jumlah yang sudah dibayar."] });
    }

    const result = await client.query(
      `UPDATE pay_later_bills
       SET provider_name = $1, description = $2, total_amount = $3, due_date = $4,
           installment_info = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [
        data.provider_name ?? bill.provider_name,
        data.description ?? bill.description,
        total,
        data.due_date ? dateOnly(data.due_date) : dateOnly(bill.due_date),
        data.installment_info ?? bill.installment_info,
        bill.id,
      ],
    );
    const updated = result.rows[0];
    updated.status = billWithComputedFields(updated).computed_status;
    await client.query(
      "UPDATE pay_later_bills SET status = $1 WHERE id = $2",
      [updated.status, updated.id],
    );
    return billWithComputedFields(updated);
  });
}

export async function deleteBill(id, userId) {
  const { record, forbidden } = await findOwned("pay_later_bills", id, userId);
  if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke tagihan ini.");
  await pool.query("DELETE FROM pay_later_bills WHERE id = $1", [record.id]);
}

export async function recordRepayment(id, userId, data) {
  return inTransaction(async (client) => {
    const { record, forbidden } = await findOwned("pay_later_bills", id, userId, client);
    if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke tagihan ini.");
    const locked = await client.query(
      "SELECT * FROM pay_later_bills WHERE id = $1 FOR UPDATE",
      [record.id],
    );
    const bill = locked.rows[0];
    const amount = Number(data.amount);
    const outstanding = Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount));

    if (amount > outstanding) {
      const format = (number) => number.toLocaleString("id-ID");
      validationError({
        amount: [`Nominal pembayaran (Rp${format(amount)}) melebihi sisa tagihan (Rp${format(outstanding)}).`],
      });
    }

    let account = null;
    if (data.account_id) {
      account = await requireAccount(data.account_id, userId, client);
      const locked = await client.query(
        "SELECT * FROM accounts WHERE id = $1 FOR UPDATE",
        [account.id],
      );
      account = locked.rows[0];
      if (Number(account.balance) < amount) {
        validationError({ account_id: ["Saldo rekening tidak mencukupi untuk pembayaran ini."] });
      }
      await client.query(
        "UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [amount, account.id],
      );
    }

    const repaymentResult = await client.query(
      `INSERT INTO pay_later_repayments
        (pay_later_bill_id, user_id, account_id, amount, repayment_date, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *`,
      [
        bill.id, userId, account?.id ?? null, amount,
        data.repayment_date ? dateOnly(data.repayment_date) : todayUtc(),
        data.notes ?? `Pembayaran tagihan ${bill.provider_name}`,
      ],
    );
    const paidAmount = Number(bill.paid_amount) + amount;
    const updatedResult = await client.query(
      `UPDATE pay_later_bills SET paid_amount = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 RETURNING *`,
      [paidAmount, bill.id],
    );
    const updatedBill = updatedResult.rows[0];
    updatedBill.status = billWithComputedFields(updatedBill).computed_status;
    await client.query(
      "UPDATE pay_later_bills SET status = $1 WHERE id = $2",
      [updatedBill.status, bill.id],
    );

    return {
      repayment: repaymentResult.rows[0],
      bill: billWithComputedFields(updatedBill),
    };
  });
}

export async function togglePaid(id, userId, accountId) {
  return inTransaction(async (client) => {
    const { record, forbidden } = await findOwned("pay_later_bills", id, userId, client);
    if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke tagihan ini.");
    const locked = await client.query(
      "SELECT * FROM pay_later_bills WHERE id = $1 FOR UPDATE",
      [record.id],
    );
    const bill = locked.rows[0];

    if (bill.status === "paid") {
      await client.query("DELETE FROM pay_later_repayments WHERE pay_later_bill_id = $1", [bill.id]);
      const reset = { ...bill, paid_amount: 0 };
      reset.status = billWithComputedFields(reset).computed_status;
      const result = await client.query(
        `UPDATE pay_later_bills SET paid_amount = 0, status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 RETURNING *`,
        [reset.status, bill.id],
      );
      return billWithComputedFields(result.rows[0]);
    }

    const remaining = Math.max(0, Number(bill.total_amount) - Number(bill.paid_amount));
    if (remaining > 0) {
      const repayment = await recordRepaymentInTransaction(client, bill, userId, remaining, accountId);
      return repayment;
    }

    return billWithComputedFields(bill);
  });
}

async function recordRepaymentInTransaction(client, bill, userId, amount, accountId) {
  let account = null;
  if (accountId) {
    account = await requireAccount(accountId, userId, client, false);
    const locked = await client.query("SELECT * FROM accounts WHERE id = $1 FOR UPDATE", [account.id]);
    account = locked.rows[0];
    if (Number(account.balance) < amount) {
      validationError({ account_id: ["Saldo rekening tidak mencukupi untuk pembayaran ini."] });
    }
    await client.query(
      "UPDATE accounts SET balance = balance - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [amount, account.id],
    );
  }

  await client.query(
    `INSERT INTO pay_later_repayments
      (pay_later_bill_id, user_id, account_id, amount, repayment_date, notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [bill.id, userId, account?.id ?? null, amount, todayUtc(), `Pelunasan tagihan ${bill.provider_name}`],
  );
  const updated = {
    ...bill,
    paid_amount: Number(bill.paid_amount) + amount,
  };
  updated.status = billWithComputedFields(updated).computed_status;
  const result = await client.query(
    `UPDATE pay_later_bills SET paid_amount = $1, status = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 RETURNING *`,
    [updated.paid_amount, updated.status, bill.id],
  );

  return billWithComputedFields(result.rows[0]);
}

export async function listRepayments(id, userId) {
  const { record: bill, forbidden } = await findOwned("pay_later_bills", id, userId);
  if (forbidden) throw new ApiError(403, "Anda tidak memiliki akses ke tagihan ini.");
  return getRepayments(pool, bill.id, true);
}
