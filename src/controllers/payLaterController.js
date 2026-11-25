import * as payLater from "../services/payLaterService.js";
import { validate } from "../middleware/validate.js";
import { payLaterBillSchema, repaymentSchema } from "../utils/validationSchemas.js";
import { success } from "../utils/responses.js";

export async function index(request, response) {
  return success(
    response,
    await payLater.listBills(request.user.id),
    "Daftar kewajiban PayLater berhasil diambil.",
  );
}

export async function store(request, response) {
  const data = validate(request.body, payLaterBillSchema, {
    provider_name: { required: "Nama penyedia PayLater wajib diisi." },
    total_amount: {
      required: "Total tagihan wajib diisi.",
      "min:1": "Total tagihan harus lebih besar dari 0.",
    },
    due_date: { required: "Tanggal jatuh tempo wajib diisi." },
  });
  return success(
    response,
    await payLater.createBill(request.user.id, data),
    "Tagihan PayLater berhasil ditambahkan.",
    201,
  );
}

export async function show(request, response) {
  return success(
    response,
    await payLater.getBill(request.params.paylater, request.user.id, true),
    "Detail tagihan PayLater berhasil diambil.",
  );
}

export async function update(request, response) {
  const data = validate(request.body, payLaterBillSchema, {
    provider_name: { required: "Nama penyedia PayLater wajib diisi." },
    total_amount: {
      required: "Total tagihan wajib diisi.",
      "min:1": "Total tagihan harus lebih besar dari 0.",
    },
    due_date: { required: "Tanggal jatuh tempo wajib diisi." },
  });
  return success(
    response,
    await payLater.updateBill(request.params.paylater, request.user.id, data),
    "Tagihan PayLater berhasil diperbarui.",
  );
}

export async function destroy(request, response) {
  await payLater.deleteBill(request.params.paylater, request.user.id);
  return success(response, null, "Tagihan PayLater berhasil dihapus.");
}

export async function togglePaid(request, response) {
  const accountId = request.body.account_id ? Number.parseInt(request.body.account_id, 10) : null;
  return success(
    response,
    await payLater.togglePaid(request.params.paylater, request.user.id, accountId),
    "Status tagihan berhasil diperbarui.",
  );
}

export async function repayments(request, response) {
  return success(
    response,
    await payLater.listRepayments(request.params.paylater, request.user.id),
    "Riwayat pembayaran berhasil diambil.",
  );
}

export async function recordRepayment(request, response) {
  const data = validate(request.body, repaymentSchema, {
    amount: {
      required: "Nominal pembayaran wajib diisi.",
      "min:1": "Nominal pembayaran harus lebih besar dari 0.",
    },
  });
  return success(
    response,
    await payLater.recordRepayment(request.params.paylater, request.user.id, data),
    "Pembayaran tagihan PayLater berhasil dicatat.",
    201,
  );
}
