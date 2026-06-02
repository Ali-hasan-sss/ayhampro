export type SmartEntryRow = {
  captainName: string;
  tripsCount: number;
  totalFare: number;
  driverId: string | null;
  matchedDriverName: string | null;
  matchConfidence: number;
  needsReview: boolean;
  sourceNames?: string[];
};

export type SmartEntryParseResult = {
  rawInvoiceCount: number;
  removedDuplicates: number;
  notes: string;
  usedAi: boolean;
  rows: SmartEntryRow[];
};

export type SmartEntryImportResult = {
  created: number;
  skipped: { captainName: string; reason: string }[];
  errors: { captainName: string; message: string }[];
};
