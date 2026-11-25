export function dateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function dateIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

export function monthRange(month, year) {
  const now = new Date();
  const targetMonth = month ?? now.getUTCMonth() + 1;
  const targetYear = year ?? now.getUTCFullYear();
  const start = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
  const end = new Date(Date.UTC(targetYear, targetMonth, 0));

  return {
    month: targetMonth,
    year: targetYear,
    start: dateOnly(start),
    end: dateOnly(end),
    days: end.getUTCDate(),
  };
}

export function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function dateDaysBetween(from, to) {
  const start = Date.parse(`${dateOnly(from)}T00:00:00Z`);
  const end = Date.parse(`${dateOnly(to)}T00:00:00Z`);
  return Math.trunc((end - start) / 86_400_000);
}
