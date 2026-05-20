import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { CampaignEditor } from "./CampaignEditor";

export const metadata = { title: "Campaign Editor — TensorWorks Admin" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CampaignEditorPage({ params }: Props) {
  const { id } = await params;

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    select: {
      id: true,
      blogPostId: true,
      type: true,
      segmentTag: true,
      subjectLine: true,
      previewText: true,
      bodyMjml: true,
      bodyHtml: true,
      bodyText: true,
      status: true,
      scheduledFor: true,
      sentAt: true,
      recipientCount: true,
      generatedBy: true,
      reviewedBy: true,
      approvedAt: true,
      createdAt: true,
      mailchimpCampaignId: true,
    },
  });

  if (!campaign) {
    notFound();
  }

  return <CampaignEditor campaign={campaign} />;
}
