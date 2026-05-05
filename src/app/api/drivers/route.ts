import { connectToDatabase } from "@/lib/db";
import { Driver } from "@/models/Driver";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2),
  phone: z
    .string()
    .trim()
    .optional()
    .default("")
    .refine((value) => value === "" || value.length >= 5, "رقم الهاتف غير صحيح"),
  role: z.enum(["driver", "coordinator"]),
  notes: z.string().optional().default(""),
});

export async function GET(request: Request) {
  await connectToDatabase();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const role = searchParams.get("role");

  const query: Record<string, unknown> = {};
  if (q) query.name = { $regex: q, $options: "i" };
  if (role && ["driver", "coordinator"].includes(role)) query.role = role;

  const drivers = await Driver.find(query).sort({ createdAt: -1 });
  return NextResponse.json(drivers);
}

export async function POST(request: Request) {
  await connectToDatabase();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "بيانات غير صحيحة" }, { status: 400 });
  }
  const created = await Driver.create(parsed.data);
  return NextResponse.json(created, { status: 201 });
}
