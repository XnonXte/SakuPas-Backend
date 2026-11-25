import * as categories from "../services/categoryService.js";
import { validate } from "../middleware/validate.js";
import { categorySchema } from "../utils/validationSchemas.js";
import { success } from "../utils/responses.js";

export async function index(request, response) {
  return success(response, await categories.listCategories(request.user.id), "Daftar kategori berhasil diambil.");
}

export async function store(request, response) {
  const data = validate(request.body, categorySchema);
  const result = await categories.createCategory(request.user.id, data);
  return success(response, result, "Kategori baru berhasil ditambahkan.", 201);
}

export async function destroy(request, response) {
  await categories.deleteCategory(request.params.category, request.user.id);
  return success(response, null, "Kategori berhasil dihapus.");
}
