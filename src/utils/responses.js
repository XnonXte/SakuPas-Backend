const dateFields = new Set(["transaction_date", "due_date", "repayment_date"]);
const timestampFields = new Set([
  "created_at",
  "updated_at",
  "email_verified_at",
  "last_used_at",
  "expires_at",
]);

function serializedTimestamp(value, withOffset = false) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const iso = date.toISOString();
  return withOffset
    ? iso.replace(/\.\d{3}Z$/, "+00:00")
    : iso.replace(/\.(\d{3})Z$/, (_match, fraction) => `.${fraction}000Z`);
}

function serializeResponseData(value, key = undefined) {
  if (value === null || value === undefined) return value;
  if (key === "activated_at") return serializedTimestamp(value, true);
  if (dateFields.has(key)) {
    const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000000Z` : value;
  }
  if (timestampFields.has(key)) return serializedTimestamp(value);
  if (value instanceof Date) return serializedTimestamp(value);
  if (Array.isArray(value)) return value.map((item) => serializeResponseData(item));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([field, item]) => [
        field,
        serializeResponseData(item, field),
      ]),
    );
  }
  return value;
}

export function success(response, data, message, status = 200) {
  return response.status(status).json({
    success: true,
    message,
    data: serializeResponseData(data),
  });
}

export function errorResponse(response, message, status, errors = undefined) {
  return response.status(status).json({
    success: false,
    message,
    ...(errors !== undefined ? { errors } : {}),
  });
}
