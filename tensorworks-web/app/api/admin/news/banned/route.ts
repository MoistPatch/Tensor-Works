import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { pattern, reason } = body as { pattern?: string; reason?: string };

  if (!pattern || typeof pattern !== "string" || !pattern.trim()) {
    return Response.json({ error: "pattern is required" }, { status: 400 });
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return Response.json({ error: "reason is required" }, { status: 400 });
  }

  try {
    const claim = await prisma.bannedClaim.create({
      data: {
        pattern: pattern.trim(),
        reason: reason.trim(),
        addedBy: user,
      },
    });
    return Response.json({ id: claim.id }, { status: 201 });
  } catch (err: unknown) {
    // Unique constraint violation on pattern
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return Response.json({ error: "That pattern already exists" }, { status: 409 });
    }
    throw err;
  }
}
