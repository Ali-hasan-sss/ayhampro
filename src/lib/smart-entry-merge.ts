import { normalizeNameKey } from "@/lib/driver-name-match";
import type { SmartEntryRow } from "@/types/smart-entry";

export type SmartEntryImportEntry = {
  driverId: string;
  captainName?: string;
  tripsCount: number;
  totalFare: number;
  discount?: number;
};

function mergeSourceNames(target: SmartEntryRow, source: SmartEntryRow) {
  const names = new Set<string>([
    ...(target.sourceNames ?? []),
    target.captainName,
    ...(source.sourceNames ?? []),
    source.captainName,
  ]);
  target.sourceNames = [...names].filter(Boolean);
}

export function mergeSmartEntryRows(rows: SmartEntryRow[]): SmartEntryRow[] {
  const map = new Map<string, SmartEntryRow>();

  for (const row of rows) {
    const key = row.driverId ?? `captain:${normalizeNameKey(row.captainName)}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...row,
        sourceNames: row.sourceNames?.length ? [...row.sourceNames] : [row.captainName],
      });
      continue;
    }

    existing.tripsCount += row.tripsCount;
    existing.totalFare = Number((existing.totalFare + row.totalFare).toFixed(4));
    mergeSourceNames(existing, row);

    if (!existing.driverId && row.driverId) {
      existing.driverId = row.driverId;
      existing.matchedDriverName = row.matchedDriverName;
      existing.matchConfidence = row.matchConfidence;
      existing.needsReview = row.needsReview;
    } else if (existing.driverId && row.driverId && existing.driverId === row.driverId) {
      existing.needsReview = existing.needsReview || row.needsReview;
      existing.matchConfidence = Math.max(existing.matchConfidence, row.matchConfidence);
    }

    if (existing.matchedDriverName) {
      existing.captainName = existing.matchedDriverName;
    }
  }

  return [...map.values()].sort((a, b) =>
    (a.matchedDriverName ?? a.captainName).localeCompare(
      b.matchedDriverName ?? b.captainName,
      "ar",
    ),
  );
}

export function mergeImportEntries(entries: SmartEntryImportEntry[]): SmartEntryImportEntry[] {
  const map = new Map<string, SmartEntryImportEntry>();

  for (const entry of entries) {
    const existing = map.get(entry.driverId);
    if (!existing) {
      map.set(entry.driverId, { ...entry });
      continue;
    }
    existing.tripsCount += entry.tripsCount;
    existing.totalFare = Number((existing.totalFare + entry.totalFare).toFixed(4));
    if (!existing.captainName && entry.captainName) {
      existing.captainName = entry.captainName;
    }
  }

  return [...map.values()];
}
