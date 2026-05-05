import { calculateCommission } from "@/lib/commission";
import { comparePassword, hashPassword } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateSettings } from "@/lib/settings";
import { Trip } from "@/models/Trip";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  commissionType: z.enum(["percentage", "fixed"]),
  commissionValue: z.number().min(0),
  companyName: z.string().min(2),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
});

export async function GET() {
  await connectToDatabase();
  const settings = await getOrCreateSettings();
  return NextResponse.json(
    {
      commissionType: settings.commissionType,
      commissionValue: settings.commissionValue,
      companyName: settings.companyName,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}

export async function PUT(request: Request) {
  await connectToDatabase();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "بيانات غير صحيحة" }, { status: 400 });
  }

  const settings = await getOrCreateSettings();
  const previousCommissionType = settings.commissionType;
  const previousCommissionValue = settings.commissionValue;
  const { currentPassword, newPassword, ...rest } = parsed.data;
  const updates: Record<string, unknown> = rest;

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { message: "كلمة المرور الحالية مطلوبة" },
        { status: 400 },
      );
    }
    const valid = await comparePassword(currentPassword, settings.adminPassword);
    if (!valid) {
      return NextResponse.json(
        { message: "كلمة المرور الحالية غير صحيحة" },
        { status: 401 },
      );
    }
    updates.adminPassword = await hashPassword(newPassword);
  }

  await settings.updateOne(updates);

  const commissionChanged =
    previousCommissionType !== parsed.data.commissionType ||
    previousCommissionValue !== parsed.data.commissionValue;

  if (commissionChanged) {
    const trips = await Trip.find().select("_id tripsCount totalAmount discount");

    if (trips.length > 0) {
      const bulkOperations = trips.map((trip) => {
        const grossCommission = calculateCommission(
          parsed.data.commissionType,
          parsed.data.commissionValue,
          trip.tripsCount,
          trip.totalAmount,
        );
        const commission = Math.max(0, Number((grossCommission - (trip.discount ?? 0)).toFixed(2)));

        return {
          updateOne: {
            filter: { _id: trip._id },
            update: { $set: { commission } },
          },
        };
      });

      await Trip.bulkWrite(bulkOperations);
    }
  }

  return NextResponse.json({ success: true });
}
