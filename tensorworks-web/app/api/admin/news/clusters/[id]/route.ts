import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_STATUSES = ["pending", "reviewed", "used", "dismissed"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const cluster = await prisma.triangulationGroup.findUnique({ where: { id } });
  if (!cluster) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { status } = body as { status?: string };

  if (!status || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    return Response.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const updated = await prisma.triangulationGroup.update({
    where: { id },
    data: { status },
  });

  return Response.json(updated);
}
