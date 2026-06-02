import OpenAI from "openai";
import type { RawWhatsAppInvoice } from "@/lib/whatsapp-invoice-extract";

export type AiAggregatedCaptain = {
  canonicalName: string;
  tripsCount: number;
  totalFare: number;
  sourceNames: string[];
};

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    captains: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          canonicalName: { type: "string" },
          tripsCount: { type: "integer", minimum: 0 },
          totalFare: { type: "number", minimum: 0 },
          sourceNames: {
            type: "array",
            items: { type: "string" },
          },
          invoiceIndices: {
            type: "array",
            items: { type: "integer", minimum: 1 },
          },
        },
        required: ["canonicalName", "tripsCount", "totalFare", "sourceNames", "invoiceIndices"],
      },
    },
    removedDuplicates: { type: "integer", minimum: 0 },
    notes: { type: "string" },
  },
  required: ["captains", "removedDuplicates", "notes"],
} as const;

export async function aggregateInvoicesWithAi(
  invoices: RawWhatsAppInvoice[],
  knownDriverNames: string[],
): Promise<{ captains: AiAggregatedCaptain[]; removedDuplicates: number; notes: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY غير مُعرّف في ملف البيئة");
  }

  const client = new OpenAI({ apiKey });
  const compactPayload = invoices.map((inv) => ({
    i: inv.index,
    t: inv.timestamp,
    c: inv.captainName,
    f: inv.fare,
  }));

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    temperature: 0.1,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "whatsapp_taxi_invoices",
        strict: true,
        schema: responseSchema,
      },
    },
    messages: [
      {
        role: "system",
        content: `أنت محلل لفواتير طلبات تكسي من تصدير واتساب.
المطلوب:
1) صف واحد فقط لكل كابتن (سائق): tripsCount = عدد الفواتير، totalFare = مجموع قيم f.
2) قيمة f بوحدة الآلاف (14 أو 14000 يعنيان 14 ألف ليرة — لا تضاعف المجموع).
3) ادمج الأسماء التي تعني نفس الشخص (أخطاء إملائية، مسافات، اختلاف بسيط).
4) لا تعدّ الرسائل المحذوفة أو المكررة لنفس الطلب الفعلي.
5) استخدم أسماء السائقين المسجلة في النظام عند التطابق الواضح.
6) أرجع invoiceIndices لكل كابتن من الفهرس i في المدخلات.

أسماء السائقين في النظام:
${knownDriverNames.map((n) => `- ${n}`).join("\n") || "(لا يوجد)"}`,
      },
      {
        role: "user",
        content: JSON.stringify(compactPayload),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("لم يُرجع النموذج أي نتيجة");
  }

  const parsed = JSON.parse(raw) as {
    captains: {
      canonicalName: string;
      tripsCount: number;
      totalFare: number;
      sourceNames: string[];
      invoiceIndices: number[];
    }[];
    removedDuplicates: number;
    notes: string;
  };

  return {
    captains: parsed.captains.map((c) => ({
      canonicalName: c.canonicalName.trim(),
      tripsCount: c.tripsCount,
      totalFare: c.totalFare,
      sourceNames: c.sourceNames,
    })),
    removedDuplicates: parsed.removedDuplicates,
    notes: parsed.notes,
  };
}
