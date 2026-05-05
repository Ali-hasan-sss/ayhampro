import { connectToDatabase } from "@/lib/db";
import { Driver } from "@/models/Driver";
import { Trip } from "@/models/Trip";
import { NextResponse } from "next/server";

function getStartOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function getEndOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function getRange(period: string) {
  const now = new Date();
  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  if (period === "all") return { from: getStartOfDay(new Date(0)), to: getEndOfDay(now) };

  // Business rule: both weekly and monthly represent current full month.
  if (period === "weekly" || period === "monthly") {
    return { from: getStartOfDay(startOfCurrentMonth), to: getEndOfDay(endOfCurrentMonth) };
  }

  return { from: getStartOfDay(now), to: getEndOfDay(now) };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectToDatabase();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "daily";
  const fromInput = searchParams.get("from");
  const toInput = searchParams.get("to");

  const defaultRange = getRange(period);
  const from = fromInput ? getStartOfDay(new Date(fromInput)) : defaultRange.from;
  const to = toInput ? getEndOfDay(new Date(toInput)) : defaultRange.to;

  const driver = await Driver.findById(id).select("name phone");
  if (!driver) {
    return NextResponse.json({ message: "السائق غير موجود" }, { status: 404 });
  }

  const baseMatch = {
    driverId: driver._id,
    date: { $gte: from, $lte: to },
  };

  const [totals] = await Trip.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$totalAmount" },
        totalTrips: { $sum: "$tripsCount" },
        totalDiscount: { $sum: "$discount" },
        totalCommission: { $sum: "$commission" },
      },
    },
  ]);

  const daily = await Trip.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: {
          date: {
            $dateToString: { format: "%Y-%m-%d", date: "$date" },
          },
        },
        totalAmount: { $sum: "$totalAmount" },
        tripsCount: { $sum: "$tripsCount" },
        discount: { $sum: "$discount" },
        commission: { $sum: "$commission" },
      },
    },
    { $sort: { "_id.date": 1 } },
    {
      $project: {
        _id: 0,
        date: "$_id.date",
        totalAmount: 1,
        tripsCount: 1,
        discount: 1,
        commission: 1,
      },
    },
  ]);

  return NextResponse.json({
    driver: { id: driver._id, name: driver.name, phone: driver.phone },
    from,
    to,
    totals:
      totals ?? {
        totalAmount: 0,
        totalTrips: 0,
        totalDiscount: 0,
        totalCommission: 0,
      },
    daily,
  });
}
