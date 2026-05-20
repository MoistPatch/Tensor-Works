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

  const item = await prisma.newsItem.findUnique({ where: { id } });
  if (!item) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { banned } = body as { banned?: boolean };

  if (typeof banned !== "boolean") {
    return Response.json({ error: "Invalid fields" }, { status: 400 });
  }

  const updated = await prisma.newsItem.update({
    where: { id },
    data: { banned },
  });

  // If banning an item that belongs to a cluster, decrement the cluster's itemCount
  if (banned && item.clusterId && !item.banned) {
    await prisma.triangulationGroup.update({
      where: { id: item.clusterId },
      data: { itemCount: { decrement: 1 } },
    });
  }

  // If unbanning an item that belongs to a cluster, increment the cluster's itemCount
  if (!banned && item.clusterId && item.banned) {
    await prisma.triangulationGroup.update({
      where: { id: item.clusterId },
      data: { itemCount: { increment: 1 } },
    });
  }

  return Response.json(updated);
}
