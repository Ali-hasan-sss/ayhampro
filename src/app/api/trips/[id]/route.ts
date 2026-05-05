import { calculateCommission } from "@/lib/commission";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateSettings } from "@/lib/settings";
import { Trip } from "@/models/Trip";
import { NextResponse } from "next/server";
import { z } from "zod";

const objectIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");

const schema = z.object({
  driverId: objectIdSchema,
  coordinatorId: objectIdSchema,
  date: z.string(),
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

  const settings = await getOrCreateSettings();
  const grossCommission = calculateCommission(
    settings.commissionType,
    settings.commissionValue,
    parsed.data.tripsCount,
    parsed.data.totalAmount,
  );
  const commission = Math.max(0, Number((grossCommission - parsed.data.discount).toFixed(2)));
  const { id } = await params;

  const updated = await Trip.findByIdAndUpdate(
    id,
    { ...parsed.data, date: new Date(parsed.data.date), commission },
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
