import { comparePassword, hashPassword } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateSettings } from "@/lib/settings";
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
  return NextResponse.json({
    commissionType: settings.commissionType,
    commissionValue: settings.commissionValue,
    companyName: settings.companyName,
  });
}

export async function PUT(request: Request) {
  await connectToDatabase();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "بيانات غير صحيحة" }, { status: 400 });
  }

  const settings = await getOrCreateSettings();
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
  return NextResponse.json({ success: true });
}
