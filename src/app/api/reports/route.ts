import { connectToDatabase } from "@/lib/db";
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

  if (period === "all") {
    return { from: getStartOfDay(new Date(0)), to: getEndOfDay(now) };
  }

  // Business rule: both weekly and monthly represent current full month.
  if (period === "weekly" || period === "monthly") {
    return { from: getStartOfDay(startOfCurrentMonth), to: getEndOfDay(endOfCurrentMonth) };
  }

  return { from: getStartOfDay(now), to: getEndOfDay(now) };
}

export async function GET(request: Request) {
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "daily";
  const fromInput = searchParams.get("from");
  const toInput = searchParams.get("to");

  const defaultRange = getRange(period);
  const from = fromInput ? getStartOfDay(new Date(fromInput)) : defaultRange.from;
  const to = toInput ? getEndOfDay(new Date(toInput)) : defaultRange.to;

  const baseMatch = { date: { $gte: from, $lte: to } };

  const [totals] = await Trip.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: null,
        totalTrips: { $sum: "$tripsCount" },
        totalRevenue: { $sum: "$totalAmount" },
        totalDiscount: { $sum: "$discount" },
        totalCommission: { $sum: "$commission" },
      },
    },
  ]);

  const byDriver = await Trip.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: "$driverId",
        tripsCount: { $sum: "$tripsCount" },
        totalAmount: { $sum: "$totalAmount" },
        discount: { $sum: "$discount" },
        commission: { $sum: "$commission" },
      },
    },
    {
      $lookup: {
        from: "drivers",
        localField: "_id",
        foreignField: "_id",
        as: "driver",
      },
    },
    { $unwind: "$driver" },
    {
      $project: {
        _id: 0,
        driverId: "$driver._id",
        driverName: "$driver.name",
        tripsCount: 1,
        totalAmount: 1,
        discount: 1,
        commission: 1,
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  const byCoordinator = await Trip.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: "$coordinatorId",
        tripsCount: { $sum: "$tripsCount" },
        totalAmount: { $sum: "$totalAmount" },
        discount: { $sum: "$discount" },
        commission: { $sum: "$commission" },
      },
    },
    {
      $lookup: {
        from: "drivers",
        localField: "_id",
        foreignField: "_id",
        as: "coordinator",
      },
    },
    { $unwind: "$coordinator" },
    {
      $project: {
        _id: 0,
        coordinatorId: "$coordinator._id",
        coordinatorName: "$coordinator.name",
        tripsCount: 1,
        totalAmount: 1,
        discount: 1,
        commission: 1,
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  return NextResponse.json({
    from,
    to,
    totals: totals ?? { totalTrips: 0, totalRevenue: 0, totalDiscount: 0, totalCommission: 0 },
    byDriver,
    byCoordinator,
  });
}
