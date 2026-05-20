import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const post = await prisma.blogPost.findUnique({ where: { id }, select: { id: true } });
  if (!post) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }

  await prisma.blogPost.update({
    where: { id },
    data: { status: "draft" },
  });

  await logAudit({
    actorEmail: user,
    action: "content.regenerate",
    target: id,
  });

  return Response.json({ success: true });
}
