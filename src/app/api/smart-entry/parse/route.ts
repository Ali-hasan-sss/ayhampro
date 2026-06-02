import { aggregateInvoicesWithAi } from "@/lib/smart-entry-ai";
import { matchDriverByName } from "@/lib/driver-name-match";
import { mergeSmartEntryRows } from "@/lib/smart-entry-merge";
import { connectToDatabase } from "@/lib/db";
import { Driver } from "@/models/Driver";
import { extractWhatsAppInvoices } from "@/lib/whatsapp-invoice-extract";
import type { SmartEntryParseResult, SmartEntryRow } from "@/types/smart-entry";
import { NextResponse } from "next/server";

const MAX_FILE_CHARS = 1_200_000;

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        {
          message:
            "مفتاح OpenAI غير مُعرّف. أضف OPENAI_API_KEY في ملف البيئة ثم أعد تشغيل السيرفر.",
        },
        { status: 503 },
      );
    }

    await connectToDatabase();

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "يرجى رفع ملف دردشة واتساب (.txt)" }, { status: 400 });
    }

    const chatText = await file.text();
    if (!chatText.trim()) {
      return NextResponse.json({ message: "الملف فارغ" }, { status: 400 });
    }
    if (chatText.length > MAX_FILE_CHARS) {
      return NextResponse.json(
        { message: "حجم الملف كبير جدًا. قسّم الدردشة أو اختر يومًا أقل." },
        { status: 400 },
      );
    }

    const rawInvoices = extractWhatsAppInvoices(chatText);
    if (rawInvoices.length === 0) {
      return NextResponse.json(
        {
          message:
            "لم يتم العثور على فواتير طلب في الملف. تأكد أن التصدير من واتساب بصيغة .txt ويحتوي على «فاتورة طلب».",
        },
        { status: 400 },
      );
    }

    const drivers = await Driver.find({ role: "driver" }).select("_id name").lean();
    const driverList = drivers.map((d) => ({
      _id: String(d._id),
      name: d.name as string,
    }));

    let removedDuplicates = 0;
    let notes = "";

    let aiResult;
    try {
      aiResult = await aggregateInvoicesWithAi(
        rawInvoices,
        driverList.map((d) => d.name),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "فشل تحليل الذكاء الاصطناعي";
      return NextResponse.json({ message }, { status: 502 });
    }

    const aggregated = aiResult.captains.map((c) => ({
      captainName: c.canonicalName,
      tripsCount: c.tripsCount,
      totalFare: c.totalFare,
      sourceNames: c.sourceNames,
    }));
    removedDuplicates = aiResult.removedDuplicates;
    notes = aiResult.notes;

    const rowsBeforeMerge: SmartEntryRow[] = aggregated.map((row) => {
      const match = matchDriverByName(row.captainName, driverList);
      const needsReview = !match.driverId || match.confidence < 0.85;
      return {
        captainName: row.captainName,
        tripsCount: row.tripsCount,
        totalFare: row.totalFare,
        driverId: match.driverId,
        matchedDriverName: match.driverName,
        matchConfidence: match.confidence,
        needsReview,
        sourceNames: row.sourceNames,
      };
    });

    const rows = mergeSmartEntryRows(rowsBeforeMerge);
    const mergedCaptainRows = rowsBeforeMerge.length - rows.length;
    if (mergedCaptainRows > 0) {
      notes = notes
        ? `${notes} · دُمج ${mergedCaptainRows} صف لنفس السائق في النظام`
        : `دُمج ${mergedCaptainRows} صف لنفس السائق في النظام`;
    }

    const payload: SmartEntryParseResult = {
      rawInvoiceCount: rawInvoices.length,
      removedDuplicates,
      notes,
      usedAi: true,
      rows,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[smart-entry/parse]", error);
    return NextResponse.json({ message: "حدث خطأ أثناء تحليل الملف" }, { status: 500 });
  }
}
