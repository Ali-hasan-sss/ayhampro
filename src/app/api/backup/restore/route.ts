import { connectToDatabase } from "@/lib/db";
import { getOrCreateSettings } from "@/lib/settings";
import { Driver } from "@/models/Driver";
import { Settings } from "@/models/Settings";
import { Trip } from "@/models/Trip";
import { NextResponse } from "next/server";
import { z } from "zod";

const backupSchema = z.object({
  version: z.number(),
  exportedAt: z.string().optional(),
  data: z.object({
    drivers: z.array(z.any()),
    trips: z.array(z.any()),
    settings: z.any(),
  }),
});

export async function POST(request: Request) {
  await connectToDatabase();
  const parsed = backupSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "ملف النسخة الاحتياطية غير صالح" }, { status: 400 });
  }

  const { drivers, trips, settings } = parsed.data.data;

  // Reset everything, then insert the backed-up data.
  // Important: order matters for references (Trip references Driver).
  await Promise.all([Driver.deleteMany({}), Trip.deleteMany({}), Settings.deleteMany({})]);

  if (drivers.length > 0) {
    await Driver.insertMany(drivers, { ordered: false });
  }
  if (trips.length > 0) {
    await Trip.insertMany(trips, { ordered: false });
  }

  // Settings: ensure we always have a settings document even if backup is empty.
  if (settings) {
    const doc = new Settings(settings);
    await doc.save();
  } else {
    await getOrCreateSettings();
  }

  return NextResponse.json({ success: true });
}

