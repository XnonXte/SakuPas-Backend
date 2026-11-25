import { pool } from "../config/database.js";
import { dateIso } from "../utils/dates.js";

export async function getSettings(userId) {
  await pool.query(
    `INSERT INTO self_lock_settings
      (user_id, is_active, lifestyle_budget_cap, hide_shopping_recommendations, created_at, updated_at)
     VALUES ($1, false, 100000, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  const result = await pool.query(
    "SELECT * FROM self_lock_settings WHERE user_id = $1",
    [userId],
  );
  return result.rows[0];
}

export async function setActive(userId, active) {
  await getSettings(userId);
  const result = await pool.query(
    `UPDATE self_lock_settings
     SET is_active = $1, activated_at = CASE WHEN $1 THEN CURRENT_TIMESTAMP ELSE activated_at END,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $2 RETURNING *`,
    [active, userId],
  );
  return result.rows[0];
}

export function restrictionsPayload(setting) {
  const cap = Number(setting.lifestyle_budget_cap);
  return {
    is_active: Boolean(setting.is_active),
    activated_at: dateIso(setting.activated_at),
    restrictions: {
      hide_shopping_recommendations: Boolean(setting.hide_shopping_recommendations),
      lifestyle_budget_cap: cap,
      rules: [
        {
          id: "hide_recommendations",
          title: "Menyembunyikan Rekomendasi Belanja",
          description: "Menghilangkan etalase flash sale, notifikasi promo, dan diskon impulsif di dalam aplikasi.",
          is_enforced: Boolean(setting.is_active),
        },
        {
          id: "cap_lifestyle",
          title: "Membatasi Alokasi Budget Lifestyle",
          description: `Membatasi budget kategori gaya hidup maksimal Rp${cap.toLocaleString("id-ID")} agar uang saku terjaga.`,
          is_enforced: Boolean(setting.is_active),
        },
      ],
    },
  };
}
