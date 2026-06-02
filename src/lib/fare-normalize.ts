/**
 * Canonical "thousands unit" used in smart entry (14 = 14,000 ل.س in storage).
 * WhatsApp may show 14, 14.000, 14000, or 14,000 for the same fare.
 */
export function normalizeFareToThousandsUnit(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= 1000) {
    return Number((raw / 1000).toFixed(4));
  }
  return raw;
}

export function parseFareFromText(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, "");
  if (!s) return null;

  if (/^\d{1,4}[.,]\d{3}$/.test(s)) {
    s = s.replace(/[.,]/g, "");
  } else {
    s = s.replace(/,/g, "");
  }

  const value = Number(s);
  if (!Number.isFinite(value) || value <= 0) return null;
  return normalizeFareToThousandsUnit(value);
}

export function fareThousandsUnitToStoredAmount(totalFareUnit: number) {
  return Number((totalFareUnit * 1000).toFixed(2));
}
