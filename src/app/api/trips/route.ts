import { calculateCommission } from "@/lib/commission";
import { connectToDatabase } from "@/lib/db";
import { hasDuplicateTripForDriverCoordinatorDay } from "@/lib/trip-duplicate";
import { getOrCreateSettings } from "@/lib/settings";
import "@/models/Driver";
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

export async function GET(request: Request) {
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const driverId = searchParams.get("driverId");
  const coordinatorId = searchParams.get("coordinatorId");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};
  if (driverId) query.driverId = driverId;
  if (coordinatorId) query.coordinatorId = coordinatorId;
  if (from || to) {
    query.date = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lte: new Date(to) } : {}),
    };
  }

  const [trips, total] = await Promise.all([
    Trip.find(query)
      .populate("driverId", "name phone role")
      .populate("coordinatorId", "name phone role")
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Trip.countDocuments(query),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return NextResponse.json({
    items: trips,
    pagination: { page, limit, total, totalPages },
  });
}

export async function POST(request: Request) {
  await connectToDatabase();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "بيانات غير صحيحة" }, { status: 400 });
  }

  const duplicate = await hasDuplicateTripForDriverCoordinatorDay({
    driverId: parsed.data.driverId,
    coordinatorId: parsed.data.coordinatorId,
    dateInput: parsed.data.date,
  });
  if (duplicate) {
    return NextResponse.json(
      {
        message:
          "يوجد بالفعل طلب لنفس السائق في هذا اليوم مع نفس المنسق، لا يمكن إضافة طلب مكرر.",
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

  const created = await Trip.create({
    ...parsed.data,
    date: new Date(parsed.data.date),
    commission,
  });

  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(request: Request) {
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ message: "تاريخ الحذف مطلوب" }, { status: 400 });
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const result = await Trip.deleteMany({
    date: { $gte: start, $lt: end },
  });

  return NextResponse.json({ success: true, deletedCount: result.deletedCount });
}
