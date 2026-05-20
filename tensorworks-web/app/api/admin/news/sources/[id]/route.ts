import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const source = await prisma.newsSource.findUnique({ where: { id } });
  if (!source) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const { active, trustScore } = body as {
    active?: boolean;
    trustScore?: number;
  };

  if (typeof active === "boolean") data.active = active;
  if (typeof trustScore === "number") data.trustScore = trustScore;

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.newsSource.update({ where: { id }, data });
  return Response.json(updated);
}
