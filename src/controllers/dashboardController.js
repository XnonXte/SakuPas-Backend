import * as dashboard from "../services/dashboardService.js";
import { success } from "../utils/responses.js";

export async function index(request, response) {
  return success(response, await dashboard.getDashboardSummary(request.user.id), "Data dashboard berhasil diambil.");
}

export async function cashFlow(request, response) {
  const month = request.query.month ? Number.parseInt(request.query.month, 10) : null;
  const year = request.query.year ? Number.parseInt(request.query.year, 10) : null;
  return success(
    response,
    await dashboard.getCashFlow(request.user.id, month, year),
    "Data arus kas bulanan berhasil diambil.",
  );
}

export async function expenseDistribution(request, response) {
  const month = request.query.month ? Number.parseInt(request.query.month, 10) : null;
  const year = request.query.year ? Number.parseInt(request.query.year, 10) : null;
  return success(
    response,
    await dashboard.getExpenseDistribution(request.user.id, month, year),
    "Distribusi pengeluaran berhasil diambil.",
  );
}

export async function safeToSpend(request, response) {
  return success(
    response,
    await dashboard.safeToSpend(request.user.id),
    "Kalkulasi Safe-to-Spend berhasil.",
  );
}
