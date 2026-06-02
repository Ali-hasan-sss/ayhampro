export type DriverForMatch = {
  _id: string;
  name: string;
};

export function normalizeNameKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string) {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function similarity(a: string, b: string) {
  const na = normalizeNameKey(a);
  const nb = normalizeNameKey(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.92;
  const distance = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - distance / maxLen;
}

export function matchDriverByName(
  captainName: string,
  drivers: DriverForMatch[],
): { driverId: string | null; driverName: string | null; confidence: number } {
  if (drivers.length === 0) {
    return { driverId: null, driverName: null, confidence: 0 };
  }

  let best: DriverForMatch | null = null;
  let bestScore = 0;

  for (const driver of drivers) {
    const score = similarity(captainName, driver.name);
    if (score > bestScore) {
      bestScore = score;
      best = driver;
    }
  }

  if (!best || bestScore < 0.72) {
    return { driverId: null, driverName: null, confidence: bestScore };
  }

  return {
    driverId: best._id,
    driverName: best.name,
    confidence: Number(bestScore.toFixed(2)),
  };
}
