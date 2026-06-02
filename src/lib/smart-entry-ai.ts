import { normalizeNameKey } from "@/lib/driver-name-match";
import OpenAI from "openai";
import type { RawWhatsAppInvoice } from "@/lib/whatsapp-invoice-extract";

export type AiAggregatedCaptain = {
  canonicalName: string;
  tripsCount: number;
  totalFare: number;
  sourceNames: string[];
};

type CaptainVariant = {
  id: number;
  label: string;
  invoiceCount: number;
};

type AiClusterResponse = {
  clusters: { canonicalName: string; variantIds: number[] }[];
  duplicateInvoiceIndices: number[];
  notes: string;
};

const clusterSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    clusters: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          canonicalName: { type: "string" },
          variantIds: {
            type: "array",
            items: { type: "integer", minimum: 1 },
          },
        },
        required: ["canonicalName", "variantIds"],
      },
    },
    duplicateInvoiceIndices: {
      type: "array",
      items: { type: "integer", minimum: 1 },
    },
    notes: { type: "string" },
  },
  required: ["clusters", "duplicateInvoiceIndices", "notes"],
} as const;

const VARIANTS_PER_REQUEST = 80;

function buildCaptainVariants(invoices: RawWhatsAppInvoice[]): CaptainVariant[] {
  const labelCounts = new Map<string, number>();
  for (const inv of invoices) {
    const label = inv.captainName.trim();
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  return [...labelCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "ar"))
    .map(([label, invoiceCount], index) => ({
      id: index + 1,
      label,
      invoiceCount,
    }));
}

function buildAggregatedFromClusters(
  invoices: RawWhatsAppInvoice[],
  clusters: AiClusterResponse["clusters"],
  duplicateIndices: Set<number>,
): { captains: AiAggregatedCaptain[]; unassignedVariants: number } {
  const invoiceByIndex = new Map(invoices.map((inv) => [inv.index, inv]));
  const variants = buildCaptainVariants(invoices);
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const labelToCanonical = new Map<string, string>();
  const assignedVariantIds = new Set<number>();

  for (const cluster of clusters) {
    const canonical = cluster.canonicalName.trim();
    if (!canonical) continue;
    for (const variantId of cluster.variantIds) {
      const variant = variantById.get(variantId);
      if (!variant) continue;
      assignedVariantIds.add(variantId);
      labelToCanonical.set(variant.label, canonical);
    }
  }

  let unassignedVariants = 0;
  for (const variant of variants) {
    if (assignedVariantIds.has(variant.id)) continue;
    unassignedVariants += 1;
    labelToCanonical.set(variant.label, variant.label);
  }

  type GroupAcc = {
    canonicalName: string;
    sourceNames: Set<string>;
    indices: number[];
  };

  const groups = new Map<string, GroupAcc>();

  for (const inv of invoices) {
    if (duplicateIndices.has(inv.index)) continue;

    const label = inv.captainName.trim();
    const canonical = labelToCanonical.get(label) ?? label;
    const key = canonical;
    let group = groups.get(key);
    if (!group) {
      group = { canonicalName: canonical, sourceNames: new Set<string>(), indices: [] };
      groups.set(key, group);
    }
    group.sourceNames.add(label);
    group.indices.push(inv.index);
  }

  const captains: AiAggregatedCaptain[] = [...groups.values()]
    .map((group) => {
      let totalFare = 0;
      for (const index of group.indices) {
        const inv = invoiceByIndex.get(index);
        if (inv) totalFare += inv.fare;
      }
      return {
        canonicalName: group.canonicalName,
        tripsCount: group.indices.length,
        totalFare: Number(totalFare.toFixed(4)),
        sourceNames: [...group.sourceNames].sort((a, b) => a.localeCompare(b, "ar")),
      };
    })
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, "ar"));

  return { captains, unassignedVariants };
}

async function classifyVariantsWithAi(
  client: OpenAI,
  variants: CaptainVariant[],
  knownDriverNames: string[],
): Promise<AiClusterResponse> {
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    temperature: 0,
    seed: 42,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "captain_name_clusters",
        strict: true,
        schema: clusterSchema,
      },
    },
    messages: [
      {
        role: "system",
        content: `أنت خبير في توحيد أسماء كباتن التكسي من واتساب.
مهمتك فقط: تجميع معرفات المتغيرات (variantIds) التي تعود لنفس الشخص.
لا تحسب المبالغ ولا عدد الطلبات.

قواعد صارمة:
1) كل variantId يجب أن يظهر في مجموعة واحدة فقط.
2) ادمج الأخطاء الإملائية والمسافات الزائدة (مثل "علي علي" و"علي  علي").
3) عند التطابق الواضح مع اسم في النظام، اجعل canonicalName مطابقًا لاسم النظام حرفيًا.
4) duplicateInvoiceIndices: فواتير مكررة لنفس الطلب الفعلي (نفس الكابتن والأجرة والوقت المتقارب) — استخدم أرقام الفواتير i من القائمة المرسلة لاحقًا إن وُجدت.
5) لا تُنشئ مجموعات فارغة.

أسماء السائقين في النظام:
${knownDriverNames.map((n) => `- ${n}`).join("\n") || "(لا يوجد)"}`,
      },
      {
        role: "user",
        content: JSON.stringify({ variants }),
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("لم يُرجع النموذج أي نتيجة");
  }

  return JSON.parse(raw) as AiClusterResponse;
}

function mergeClustersByNormalizedName(
  clusters: AiClusterResponse["clusters"],
): AiClusterResponse["clusters"] {
  const byKey = new Map<string, { canonicalName: string; variantIds: Set<number> }>();

  for (const cluster of clusters) {
    const canonical = cluster.canonicalName.trim();
    if (!canonical) continue;
    const key = normalizeNameKey(canonical);
    const existing = byKey.get(key);
    if (existing) {
      for (const id of cluster.variantIds) existing.variantIds.add(id);
    } else {
      byKey.set(key, {
        canonicalName: canonical,
        variantIds: new Set(cluster.variantIds),
      });
    }
  }

  return [...byKey.values()].map((entry) => ({
    canonicalName: entry.canonicalName,
    variantIds: [...entry.variantIds].sort((a, b) => a - b),
  }));
}

function mergeClusterResponses(responses: AiClusterResponse[]): AiClusterResponse {
  const allClusters: AiClusterResponse["clusters"] = [];
  const notes: string[] = [];

  for (const response of responses) {
    notes.push(response.notes);
    allClusters.push(...response.clusters);
  }

  return {
    clusters: mergeClustersByNormalizedName(allClusters),
    duplicateInvoiceIndices: [],
    notes: notes.filter(Boolean).join(" · "),
  };
}

/** Same captain + fare + timestamp → keep first invoice only */
function findDuplicateInvoiceIndices(invoices: RawWhatsAppInvoice[]): Set<number> {
  const seen = new Map<string, number>();
  const duplicates = new Set<number>();

  for (const inv of invoices) {
    const key = `${normalizeNameKey(inv.captainName)}|${inv.fare}|${inv.timestamp}`;
    const firstIndex = seen.get(key);
    if (firstIndex !== undefined) {
      duplicates.add(inv.index);
    } else {
      seen.set(key, inv.index);
    }
  }

  return duplicates;
}

export async function aggregateInvoicesWithAi(
  invoices: RawWhatsAppInvoice[],
  knownDriverNames: string[],
): Promise<{ captains: AiAggregatedCaptain[]; removedDuplicates: number; notes: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY غير مُعرّف في ملف البيئة");
  }

  const client = new OpenAI({ apiKey });
  const allVariants = buildCaptainVariants(invoices);

  const clusterResponses: AiClusterResponse[] = [];
  for (let offset = 0; offset < allVariants.length; offset += VARIANTS_PER_REQUEST) {
    const chunk = allVariants.slice(offset, offset + VARIANTS_PER_REQUEST);
    clusterResponses.push(await classifyVariantsWithAi(client, chunk, knownDriverNames));
  }

  const mergedClusters = mergeClusterResponses(clusterResponses);
  const duplicateIndices = findDuplicateInvoiceIndices(invoices);

  const { captains, unassignedVariants } = buildAggregatedFromClusters(
    invoices,
    mergedClusters.clusters,
    duplicateIndices,
  );

  const assignedInvoices = captains.reduce((sum, c) => sum + c.tripsCount, 0);
  const notesParts = [mergedClusters.notes];
  if (unassignedVariants > 0) {
    notesParts.push(`تعذر ربط ${unassignedVariants} شكل اسم — اُستخدم الاسم كما في الملف`);
  }
  notesParts.push(`فواتير محسوبة: ${assignedInvoices} من ${invoices.length}`);

  return {
    captains,
    removedDuplicates: duplicateIndices.size,
    notes: notesParts.filter(Boolean).join(" · "),
  };
}
