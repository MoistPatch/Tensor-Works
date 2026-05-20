import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return Response.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { id } = await params;

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const allowedFields = [
    "subjectLine",
    "previewText",
    "bodyMjml",
    "bodyHtml",
    "bodyText",
    "scheduledFor",
  ] as const;

  const data: Partial<Record<string, unknown>> = {};
  for (const field of allowedFields) {
    if (field in body && body[field] !== undefined) {
      if (field === "scheduledFor") {
        const val = body[field];
        data[field] = val ? new Date(val as string) : null;
      } else {
        data[field] = body[field];
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "No valid fields provided" }, { status: 400 });
  }

  await prisma.emailCampaign.update({ where: { id }, data });

  return Response.json({ success: true });
}
