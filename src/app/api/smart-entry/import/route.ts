import { calculateCommission } from "@/lib/commission";
import { connectToDatabase } from "@/lib/db";
import { fareThousandsUnitToStoredAmount } from "@/lib/fare-normalize";
import { getOrCreateSettings } from "@/lib/settings";
import { mergeImportEntries } from "@/lib/smart-entry-merge";
import { hasDuplicateTripForDriverCoordinatorDay } from "@/lib/trip-duplicate";
import { parseDateOnlyParts, utcMidnightFromDateOnly } from "@/lib/trip-calendar-date";
import { Driver } from "@/models/Driver";
import { Trip } from "@/models/Trip";
import type { SmartEntryImportResult } from "@/types/smart-entry";
import { NextResponse } from "next/server";
import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const entrySchema = z.object({
  driverId: objectIdSchema,
  captainName: z.string().optional(),
  tripsCount: z.number().int().min(1),
  totalFare: z.number().min(0),
  discount: z.number().min(0).optional().default(0),
});

const schema = z.object({
  coordinatorId: objectIdSchema,
  date: z.string().refine((s) => parseDateOnlyParts(s) !== null, "تاريخ غير صالح"),
  entries: z.array(entrySchema).min(1),
});

export async function POST(request: Request) {
  await connectToDatabase();

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "بيانات غير صحيحة" }, { status: 400 });
  }

  const coordinator = await Driver.findOne({
    _id: parsed.data.coordinatorId,
    role: "coordinator",
  }).lean();
  if (!coordinator) {
    return NextResponse.json({ message: "المنسق المحدد غير موجود" }, { status: 400 });
  }

  const settings = await getOrCreateSettings();
  const result: SmartEntryImportResult = {
    created: 0,
    skipped: [],
    errors: [],
  };

  const entries = mergeImportEntries(parsed.data.entries);

  for (const entry of entries) {
    const label = entry.captainName ?? entry.driverId;
    const driver = await Driver.findOne({ _id: entry.driverId, role: "driver" }).lean();
    if (!driver) {
      result.errors.push({ captainName: label, message: "السائق غير موجود في النظام" });
      continue;
    }

    const duplicate = await hasDuplicateTripForDriverCoordinatorDay({
      driverId: entry.driverId,
      coordinatorId: parsed.data.coordinatorId,
      dateInput: parsed.data.date,
    });
    if (duplicate) {
      result.skipped.push({
        captainName: driver.name as string,
        reason: "يوجد طلب مسجل مسبقًا لنفس السائق والمنسق في هذا اليوم",
      });
      continue;
    }

    const totalAmount = fareThousandsUnitToStoredAmount(entry.totalFare);
    if (totalAmount <= 0) {
      result.errors.push({ captainName: driver.name as string, message: "المبلغ الإجمالي غير صالح" });
      continue;
    }

    const discount = entry.discount ?? 0;
    const grossCommission = calculateCommission(
      settings.commissionType,
      settings.commissionValue,
      entry.tripsCount,
      totalAmount,
    );
    const commission = Math.max(0, Number((grossCommission - discount).toFixed(2)));

    try {
      await Trip.create({
        driverId: entry.driverId,
        coordinatorId: parsed.data.coordinatorId,
        date: utcMidnightFromDateOnly(parsed.data.date),
        tripsCount: entry.tripsCount,
        totalAmount,
        discount,
        commission,
      });
      result.created += 1;
    } catch {
      result.errors.push({
        captainName: driver.name as string,
        message: "فشل حفظ السجل",
      });
    }
  }

  return NextResponse.json(result, { status: result.created > 0 ? 201 : 200 });
}
