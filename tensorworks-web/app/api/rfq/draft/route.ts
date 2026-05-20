import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email, data } = body as { email?: string; data?: unknown };

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return Response.json({ error: "Valid email required" }, { status: 400 });
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + DRAFT_TTL_MS);

  const draft = await prisma.rFQDraft.upsert({
    where: { token },
    create: { token, email, data: data ?? {}, expiresAt },
    update: { data: data ?? {}, expiresAt },
  });

  return Response.json({ token: draft.token }, { status: 200 });
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");

  if (!token) {
    return Response.json({ error: "Token required" }, { status: 400 });
  }

  const draft = await prisma.rFQDraft.findUnique({ where: { token } });

  if (!draft || draft.expiresAt < new Date()) {
    return Response.json({ error: "Draft not found or expired" }, { status: 404 });
  }

  return Response.json({ data: draft.data, email: draft.email });
}
