import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
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

  let reviewNotes: string | undefined;
  try {
    const body = await req.json();
    reviewNotes = typeof body?.reviewNotes === "string" ? body.reviewNotes : undefined;
  } catch {
    // Body is optional
  }

  await prisma.blogPost.update({
    where: { id },
    data: {
      status: "rejected",
      reviewedBy: user,
      reviewedAt: new Date(),
      ...(reviewNotes !== undefined && { reviewNotes }),
    },
  });

  await logAudit({
    actorEmail: user,
    action: "content.reject",
    target: id,
  });

  return Response.json({ success: true });
}
