import * as accounts from "../services/accountService.js";
import { validate } from "../middleware/validate.js";
import { accountSchema } from "../utils/validationSchemas.js";
import { success } from "../utils/responses.js";

export async function index(request, response) {
  return success(response, await accounts.listAccounts(request.user.id), "Daftar rekening berhasil diambil.");
}

export async function store(request, response) {
  const data = validate(request.body, accountSchema);
  return success(response, await accounts.createAccount(request.user.id, data), "Rekening berhasil ditambahkan.", 201);
}

export async function show(request, response) {
  return success(response, await accounts.getOwnedAccount(request.params.account, request.user.id), "Detail rekening berhasil diambil.");
}

export async function update(request, response) {
  const data = validate(request.body, accountSchema);
  const result = await accounts.updateAccount(request.params.account, request.user.id, data);
  return success(response, result, "Rekening berhasil diperbarui.");
}

export async function destroy(request, response) {
  await accounts.deleteAccount(request.params.account, request.user.id);
  return success(response, null, "Rekening berhasil dihapus.");
}
