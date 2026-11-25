import * as budgets from "../services/budgetService.js";
import { validate } from "../middleware/validate.js";
import { budgetSchema } from "../utils/validationSchemas.js";
import { success } from "../utils/responses.js";

export async function index(request, response) {
  const month = request.query.month ? Number.parseInt(request.query.month, 10) : null;
  const year = request.query.year ? Number.parseInt(request.query.year, 10) : null;
  return success(response, await budgets.listBudgets(request.user.id, month, year), "Data alokasi budget berhasil diambil.");
}

export async function store(request, response) {
  const data = validate(request.body, budgetSchema, {
    category_id: { required: "Kategori budget wajib dipilih." },
    amount: {
      required: "Nominal alokasi wajib diisi.",
      "min:0": "Nominal alokasi tidak boleh negatif.",
    },
  });
  const result = await budgets.saveBudget(request.user.id, data);
  return success(response, result, "Alokasi budget berhasil disimpan.");
}

export async function destroy(request, response) {
  await budgets.deleteBudget(request.params.budget, request.user.id);
  return success(response, null, "Alokasi budget berhasil dihapus.");
}
