import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { createCampaign, scheduleCampaign } from "@/lib/mailchimp";
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

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      subjectLine: true,
      previewText: true,
      bodyHtml: true,
      bodyText: true,
      segmentTag: true,
      status: true,
    },
  });
  if (!campaign) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  let scheduledFor: Date;
  try {
    const body = await req.json();
    if (!body?.scheduledFor) {
      return Response.json({ error: "scheduledFor is required" }, { status: 400 });
    }
    scheduledFor = new Date(body.scheduledFor as string);
    if (isNaN(scheduledFor.getTime())) {
      return Response.json({ error: "Invalid scheduledFor date" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const mailchimpCampaignId = await createCampaign({
      subject: campaign.subjectLine,
      previewText: campaign.previewText,
      htmlBody: campaign.bodyHtml,
      textBody: campaign.bodyText,
      segmentTag: campaign.segmentTag,
    });

    await scheduleCampaign(mailchimpCampaignId, scheduledFor);

    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: "scheduled",
        scheduledFor,
        mailchimpCampaignId,
      },
    });

    await logAudit({
      actorEmail: user,
      action: "campaign.schedule",
      target: id,
    });

    return Response.json({ success: true, mailchimpCampaignId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
