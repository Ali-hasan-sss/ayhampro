import { connectToDatabase } from "@/lib/db";
import { getOrCreateSettings } from "@/lib/settings";
import { Driver } from "@/models/Driver";
import { Settings } from "@/models/Settings";
import { Trip } from "@/models/Trip";
import { NextResponse } from "next/server";

export async function GET() {
  await connectToDatabase();

  const [drivers, trips, settings] = await Promise.all([
    Driver.find().lean(),
    Trip.find().lean(),
    // Ensure we always export exactly one settings document.
    Settings.findOne().lean().then((s) => s ?? getOrCreateSettings().then((doc) => doc.toObject() as any)),
  ]);

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      drivers,
      trips,
      settings,
    },
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

