const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses YYYY-MM-DD as a civil calendar day in UTC (matches HTML date input semantics). */
export function parseDateOnlyParts(dateInput: string): { y: number; m: number; d: number } | null {
  const m = dateInput.trim().match(DATE_ONLY);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const t = Date.UTC(y, mo - 1, d, 0, 0, 0, 0);
  const check = new Date(t);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null;
  }
  return { y, m: mo, d };
}

export function getUtcDayBoundsFromDateOnly(dateInput: string) {
  const parts = parseDateOnlyParts(dateInput);
  if (!parts) {
    throw new Error("Invalid date-only string");
  }
  const { y, m, d } = parts;
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
  return { start, end };
}

export function utcMidnightFromDateOnly(dateInput: string): Date {
  const parts = parseDateOnlyParts(dateInput);
  if (!parts) {
    throw new Error("Invalid date-only string");
  }
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d, 0, 0, 0, 0));
}

/** Bounds for duplicate checks and filters; prefers strict YYYY-MM-DD, else UTC components of parsed instant. */
export function getUtcDayBoundsFromTripDateInput(dateInput: string) {
  const trimmed = dateInput.trim();
  if (DATE_ONLY.test(trimmed)) {
    return getUtcDayBoundsFromDateOnly(trimmed);
  }
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date string");
  }
  const y = parsed.getUTCFullYear();
  const m = parsed.getUTCMonth();
  const d = parsed.getUTCDate();
  const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
  return { start, end };
}

export function calendarDateKeyFromUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
