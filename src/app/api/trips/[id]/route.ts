import { calculateCommission } from "@/lib/commission";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateSettings } from "@/lib/settings";
import { hasDuplicateTripForDriverCoordinatorDay } from "@/lib/trip-duplicate";
import { parseDateOnlyParts, utcMidnightFromDateOnly } from "@/lib/trip-calendar-date";
import { Trip } from "@/models/Trip";
import { NextResponse } from "next/server";
import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const dateOnlySchema = z
  .string()
  .refine((s) => parseDateOnlyParts(s) !== null, "تاريخ غير صالح");

const schema = z.object({
  driverId: objectIdSchema,
  coordinatorId: objectIdSchema,
  date: dateOnlySchema,
  tripsCount: z.number().int().min(0),
  totalAmount: z.number().min(0),
  discount: z.number().min(0).optional().default(0),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectToDatabase();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "بيانات غير صحيحة" }, { status: 400 });
  }

  const { id } = await params;
  const duplicate = await hasDuplicateTripForDriverCoordinatorDay({
    driverId: parsed.data.driverId,
    coordinatorId: parsed.data.coordinatorId,
    dateInput: parsed.data.date,
    excludeTripId: id,
  });
  if (duplicate) {
    return NextResponse.json(
      {
        message:
          "يوجد بالفعل طلب لنفس السائق في هذا اليوم مع نفس المنسق، لا يمكن حفظ هذا التعديل.",
      },
      { status: 409 },
    );
  }

  const settings = await getOrCreateSettings();
  const grossCommission = calculateCommission(
    settings.commissionType,
    settings.commissionValue,
    parsed.data.tripsCount,
    parsed.data.totalAmount,
  );
  const commission = Math.max(0, Number((grossCommission - parsed.data.discount).toFixed(2)));

  const updated = await Trip.findByIdAndUpdate(
    id,
    { ...parsed.data, date: utcMidnightFromDateOnly(parsed.data.date), commission },
    { new: true },
  );
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectToDatabase();
  const { id } = await params;
  await Trip.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
