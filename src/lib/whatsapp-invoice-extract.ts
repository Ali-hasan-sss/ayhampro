import { parseFareFromText } from "@/lib/fare-normalize";

export type RawWhatsAppInvoice = {
  index: number;
  timestamp: string;
  sender: string;
  captainName: string;
  fare: number;
};

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_ARABIC = "۰۱۲۳۴۵۶۷۸۹";

function toWesternDigits(value: string) {
  return value
    .split("")
    .map((ch) => {
      const ar = ARABIC_INDIC.indexOf(ch);
      if (ar >= 0) return String(ar);
      const fa = EASTERN_ARABIC.indexOf(ch);
      if (fa >= 0) return String(fa);
      return ch;
    })
    .join("");
}

function cleanChatText(chatText: string) {
  return toWesternDigits(chatText).replace(/[\u200f\u200e\u202a\u202c]/g, "");
}

const MESSAGE_HEADER =
  /^([0-9]+\/[0-9]+\/[0-9]+،\s+[0-9:٫،\sصم]+)\s+-\s+([^:]+):\s*(.*)$/u;

function parseFare(line: string): number | null {
  const match = line.match(/الاجرة\*?\s*([0-9][0-9.,\s]*)/u);
  if (!match) return null;
  return parseFareFromText(match[1]);
}

function parseCaptain(line: string): string | null {
  const match = line.match(/أسم\s*الكابتن\*?\s*(.+?)\s*$/u);
  if (!match) return null;
  return match[1].replace(/\*/g, "").trim();
}

export function extractWhatsAppInvoices(chatText: string): RawWhatsAppInvoice[] {
  const lines = cleanChatText(chatText).split(/\r?\n/);
  const invoices: RawWhatsAppInvoice[] = [];
  let currentHeader: { timestamp: string; sender: string } | null = null;
  let currentLines: string[] = [];
  let index = 0;

  const flush = () => {
    if (!currentHeader || currentLines.length === 0) return;
    const body = currentLines.join("\n");
    if (!body.includes("فاتورة طلب")) {
      currentLines = [];
      return;
    }
    if (body.includes("تم حذف هذه الرسالة")) {
      currentLines = [];
      return;
    }

    let captainName: string | null = null;
    let fare: number | null = null;
    for (const line of currentLines) {
      captainName ??= parseCaptain(line);
      fare ??= parseFare(line);
    }

    if (captainName && fare !== null && fare > 0) {
      invoices.push({
        index: ++index,
        timestamp: currentHeader.timestamp,
        sender: currentHeader.sender,
        captainName,
        fare,
      });
    }
    currentLines = [];
  };

  for (const line of lines) {
    const headerMatch = line.match(MESSAGE_HEADER);
    if (headerMatch) {
      flush();
      currentHeader = {
        timestamp: headerMatch[1].trim(),
        sender: headerMatch[2].trim(),
      };
      const firstLine = headerMatch[3]?.trim() ?? "";
      currentLines = firstLine ? [firstLine] : [];
      continue;
    }
    if (currentHeader) {
      currentLines.push(line);
    }
  }
  flush();

  return invoices;
}

export function aggregateInvoicesLocally(
  invoices: RawWhatsAppInvoice[],
): { captainName: string; tripsCount: number; totalFare: number }[] {
  const map = new Map<string, { captainName: string; tripsCount: number; totalFare: number }>();

  for (const inv of invoices) {
    const key = inv.captainName.replace(/\s+/g, " ").trim().toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.tripsCount += 1;
      existing.totalFare += inv.fare;
    } else {
      map.set(key, {
        captainName: inv.captainName.trim(),
        tripsCount: 1,
        totalFare: inv.fare,
      });
    }
  }

  return [...map.values()].sort((a, b) => a.captainName.localeCompare(b.captainName, "ar"));
}
