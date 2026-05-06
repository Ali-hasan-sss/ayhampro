export function formatAmount(value: number) {
  if (Number.isInteger(value)) return value.toString();
  return value.toFixed(2).replace(/\.?0+$/, "");
}

export function formatCurrency(value: number) {
  return `${formatAmount(value)} ل.س`;
}

/** Gregorian calendar in Arabic locale (avoids Hijri default in some browsers for ar-SA). */
export function formatGregorianDateAr(isoDate: string | Date) {
  const d = typeof isoDate === "string" ? new Date(isoDate) : isoDate;
  return d.toLocaleDateString("ar-SA", {
    calendar: "gregory",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}
