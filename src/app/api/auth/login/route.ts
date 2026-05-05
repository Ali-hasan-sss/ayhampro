import { comparePassword, signAuthToken, AUTH_COOKIE } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateSettings } from "@/lib/settings";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  password: z.string().min(6),
});

export async function POST(request: Request) {
  await connectToDatabase();
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "بيانات غير صحيحة" }, { status: 400 });
  }

  const settings = await getOrCreateSettings();
  const valid = await comparePassword(parsed.data.password, settings.adminPassword);
  if (!valid) {
    return NextResponse.json({ message: "كلمة المرور خاطئة" }, { status: 401 });
  }

  const token = await signAuthToken({ sub: "admin", role: "admin" });
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return NextResponse.json({ success: true });
}
