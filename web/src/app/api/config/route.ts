import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const configPath = path.resolve(process.cwd(), "..", "cfg", "config.json");
  const raw = await fs.readFile(configPath, "utf8");
  const json = JSON.parse(raw);
  return NextResponse.json(json, { status: 200 });
}
