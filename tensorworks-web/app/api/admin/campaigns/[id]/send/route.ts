import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { sendCampaignNow } from "@/lib/mailchimp";
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
    select: { id: true, mailchimpCampaignId: true, status: true },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }
  if (!campaign.mailchimpCampaignId) {
    return Response.json(
      { error: "Campaign has not been scheduled in Mailchimp yet. Use Approve + Schedule first." },
      { status: 422 }
    );
  }

  try {
    await sendCampaignNow(campaign.mailchimpCampaignId);

    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
      },
    });

    await logAudit({
      actorEmail: user,
      action: "campaign.send",
      target: id,
    });

    return Response.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
