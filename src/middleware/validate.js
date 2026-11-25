import { validationError } from "../utils/errors.js";

const messageFor = (rule, field) => {
  const messages = {
    "required:name": "Nama lengkap wajib diisi.",
    "required:email": "Email wajib diisi.",
    "required:password": "Password wajib diisi.",
    "email:email": "Format email tidak valid.",
    "min8:password": "Password minimal terdiri dari 8 karakter.",
    "confirmed:password": "Konfirmasi password tidak cocok.",
    "unique:email": "Email sudah terdaftar.",
    "required:account_id": "Pilih rekening atau sumber dana.",
    "required:category_id": "Pilih kategori transaksi.",
    "required:type": "Tentukan jenis transaksi (income / expense).",
    "required:amount": "Nominal transaksi wajib diisi.",
    "required:description": "Deskripsi transaksi wajib diisi.",
    "required:transaction_date": "Tanggal transaksi wajib diisi.",
    "required:provider_name": "Nama penyedia PayLater wajib diisi.",
    "required:total_amount": "Total tagihan wajib diisi.",
    "required:due_date": "Tanggal jatuh tempo wajib diisi.",
    "min:amount": "Nominal harus lebih besar dari 0.",
    "min:total_amount": "Total tagihan harus lebih besar dari 0.",
    "min:year": "year memiliki nilai yang terlalu kecil.",
  };

  if (messages[`${rule}:${field}`]) return messages[`${rule}:${field}`];
  if (rule === "confirmed") return "Konfirmasi password tidak cocok.";
  if (rule === "email") return "Format email tidak valid.";
  if (rule === "integer") return `${field} harus berupa bilangan bulat.`;
  if (rule === "date") return `${field} harus berupa tanggal yang valid.`;
  if (rule.startsWith("oneOf:")) return `${field} memiliki nilai yang tidak valid.`;
  if (rule.startsWith("max:")) return `${field} melebihi panjang maksimum.`;
  if (rule.startsWith("between:")) return `${field} memiliki nilai yang tidak valid.`;
  if (rule.startsWith("min:")) return `${field} memiliki nilai yang terlalu kecil.`;
  return `${field} tidak valid.`;
};

function isInteger(value) {
  return (typeof value === "number" && Number.isInteger(value))
    || (typeof value === "string" && /^-?\d+$/.test(value));
}

export function validate(data, schema, messages = {}) {
  const errors = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    for (const rule of rules) {
      if (rule === "nullable" && (value === undefined || value === null || value === "")) {
        break;
      }

      let valid = true;
      if (rule === "required") valid = value !== undefined && value !== null && value !== "";
      else if (rule === "string") valid = typeof value === "string";
      else if (rule === "email") valid = typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      else if (rule === "integer") valid = isInteger(value);
      else if (rule === "positive") valid = isInteger(value) && Number(value) > 0;
      else if (rule === "nonnegative") valid = isInteger(value) && Number(value) >= 0;
      else if (rule === "min8") valid = typeof value === "string" && value.length >= 8;
      else if (rule === "confirmed") valid = value === data.password_confirmation;
      else if (rule.startsWith("oneOf:")) valid = rule.slice(6).split(",").includes(value);
      else if (rule.startsWith("max:")) {
        const max = Number(rule.slice(4));
        valid = typeof value === "string" && value.length <= max;
      } else if (rule.startsWith("between:")) {
        const [min, max] = rule.slice(8).split(",").map(Number);
        valid = isInteger(value) && Number(value) >= min && Number(value) <= max;
      } else if (rule.startsWith("min:")) valid = isInteger(value) && Number(value) >= Number(rule.slice(4));
      else if (rule === "date") valid = typeof value === "string" && !Number.isNaN(Date.parse(value));

      if (!valid) {
        errors[field] ??= [];
        errors[field].push(messages[field]?.[rule] || messageFor(rule, field));
        break;
      }
    }
  }

  if (Object.keys(errors).length) validationError(errors);

  return Object.fromEntries(
    Object.keys(schema)
      .filter((field) => Object.hasOwn(data, field))
      .map((field) => [field, data[field]]),
  );
}
