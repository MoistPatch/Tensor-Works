import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const claim = await prisma.bannedClaim.findUnique({ where: { id } });
  if (!claim) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.bannedClaim.delete({ where: { id } });

  return new Response(null, { status: 204 });
}
