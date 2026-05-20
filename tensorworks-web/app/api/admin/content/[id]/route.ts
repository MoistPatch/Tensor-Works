import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function PATCH(
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { title, subtitle, body: postBody } = body as {
    title?: string;
    subtitle?: string;
    body?: string;
  };

  await prisma.blogPost.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(subtitle !== undefined && { subtitle }),
      ...(postBody !== undefined && { body: postBody }),
    },
  });

  await logAudit({
    actorEmail: user,
    action: "content.edit",
    target: id,
    metadata: {
      updatedFields: Object.keys({ title, subtitle, body: postBody }).filter(
        (k) => ({ title, subtitle, body: postBody } as Record<string, unknown>)[k] !== undefined
      ),
    },
  });

  return Response.json({ success: true });
}
