import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export async function POST(req: NextRequest) {
  const data = await req.formData();
  const file = data.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > 8 * 1024 * 1024)
    return NextResponse.json({ error: "File must be smaller than 8MB" }, { status: 400 });
  if (file.type && !ALLOWED.includes(file.type))
    return NextResponse.json({ error: "Only image files can be uploaded" }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = `r_${Date.now()}_${Math.floor(performance.now() * 1000) % 100000}.${ext}`;
  await writeFile(join(dir, name), bytes);

  return NextResponse.json({ url: `/uploads/${name}` }, { status: 201 });
}
