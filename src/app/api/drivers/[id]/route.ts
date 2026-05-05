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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectToDatabase();
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ message: "بيانات غير صحيحة" }, { status: 400 });
  }
  const { id } = await params;
  const updated = await Driver.findByIdAndUpdate(id, parsed.data, { new: true });
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connectToDatabase();
  const { id } = await params;
  await Driver.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}
