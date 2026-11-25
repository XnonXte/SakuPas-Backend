import * as transactions from "../services/transactionService.js";
import { validate } from "../middleware/validate.js";
import { transactionSchema } from "../utils/validationSchemas.js";
import { success } from "../utils/responses.js";

export async function index(request, response) {
  const result = await transactions.listTransactions(request.user.id, request.query);
  return success(response, result, "Daftar transaksi berhasil diambil.");
}

export async function store(request, response) {
  const data = validate(request.body, transactionSchema, {
    amount: { "min:1": "Nominal transaksi harus lebih besar dari 0." },
  });
  const result = await transactions.createTransaction(request.user, data);
  return success(response, result, "Transaksi berhasil disimpan.", 201);
}

export async function show(request, response) {
  const result = await transactions.getTransaction(request.params.transaction, request.user.id);
  return success(response, result, "Detail transaksi berhasil diambil.");
}

export async function update(request, response) {
  const data = validate(request.body, transactionSchema, {
    amount: { "min:1": "Nominal transaksi harus lebih besar dari 0." },
  });
  const result = await transactions.updateTransaction(request.params.transaction, request.user.id, data);
  return success(response, result, "Transaksi berhasil diperbarui.");
}

export async function destroy(request, response) {
  await transactions.deleteTransaction(request.params.transaction, request.user.id);
  return success(response, null, "Transaksi berhasil dihapus.");
}
