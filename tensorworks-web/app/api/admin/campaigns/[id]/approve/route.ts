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

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  await prisma.emailCampaign.update({
    where: { id },
    data: {
      status: "approved",
      approvedAt: new Date(),
      reviewedBy: user,
    },
  });

  await logAudit({
    actorEmail: user,
    action: "campaign.approve",
    target: id,
  });

  return Response.json({ success: true });
}
