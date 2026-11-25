import { getSettings, restrictionsPayload, setActive } from "../services/modeHematService.js";
import { success } from "../utils/responses.js";

export async function index(request, response) {
  const setting = await getSettings(request.user.id);
  return success(response, restrictionsPayload(setting), "Status Mode Hemat berhasil diambil.");
}

export async function activate(request, response) {
  const setting = await setActive(request.user.id, true);
  return success(
    response,
    restrictionsPayload(setting),
    "Penguncian Mandiri (Mode Hemat) berhasil diaktifkan.",
  );
}

export async function deactivate(request, response) {
  const setting = await setActive(request.user.id, false);
  return success(
    response,
    restrictionsPayload(setting),
    "Penguncian Mandiri (Mode Hemat) berhasil dinonaktifkan.",
  );
}
