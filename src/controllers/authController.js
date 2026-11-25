import bcrypt from "bcryptjs";
import { validate } from "../middleware/validate.js";
import { loginSchema, profileSchema, registerSchema } from "../utils/validationSchemas.js";
import { success } from "../utils/responses.js";
import * as authService from "../services/authService.js";

export async function register(request, response) {
  const data = validate(request.body, registerSchema);
  const result = await authService.register(data);
  return success(response, result, "Registrasi berhasil.", 201);
}

export async function login(request, response) {
  const data = validate(request.body, loginSchema);
  const result = await authService.login(data);
  return success(response, result, "Login berhasil.");
}

export async function logout(request, response) {
  await authService.logout(request.accessToken.id, request.user.id);
  return success(response, null, "Logout berhasil.");
}

export async function user(request, response) {
  const profile = await authService.getProfile(request.user.id);
  return success(response, {
    id: request.user.id,
    name: request.user.name,
    email: request.user.email,
    accounts: profile.accounts,
    mode_hemat_active: profile.mode_hemat_active,
  }, "Data profil berhasil diambil.");
}

export async function updateProfile(request, response) {
  const data = validate(request.body, profileSchema);
  const result = await authService.updateProfile(request.user.id, data);
  return success(response, result, "Profil berhasil diperbarui.");
}
