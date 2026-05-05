import { requireAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await requireAuth();
  return NextResponse.json({ authenticated: Boolean(user), user });
}
