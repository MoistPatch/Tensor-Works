import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { unsubscribeContact } from "@/lib/mailchimp";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const subscriber = await prisma.newsletterSubscriber.findUnique({ where: { id } });
  if (!subscriber) return Response.json({ error: "Not found" }, { status: 404 });

  const { action, tags, unsubscribeReason } = body as {
    action?: "unsubscribe" | "resubscribe" | "tag" | "untag";
    tags?: string[];
    unsubscribeReason?: string;
  };

  if (action === "unsubscribe") {
    await prisma.newsletterSubscriber.update({
      where: { id },
      data: { status: "unsubscribed", unsubscribedAt: new Date(), unsubscribeReason: unsubscribeReason ?? "admin_action" },
    });
    if (subscriber.mailchimpId) {
      await unsubscribeContact(subscriber.email).catch(() => null);
    }
    await logAudit({ actorEmail: user, action: "subscriber.unsubscribe", target: subscriber.email });
  } else if (action === "tag" && Array.isArray(tags)) {
    const newTags = [...new Set([...subscriber.tags, ...tags])];
    await prisma.newsletterSubscriber.update({ where: { id }, data: { tags: newTags } });
    await logAudit({ actorEmail: user, action: "subscriber.tag", target: subscriber.email, metadata: { tags } });
  } else if (action === "untag" && Array.isArray(tags)) {
    const newTags = subscriber.tags.filter((t) => !tags.includes(t));
    await prisma.newsletterSubscriber.update({ where: { id }, data: { tags: newTags } });
    await logAudit({ actorEmail: user, action: "subscriber.untag", target: subscriber.email, metadata: { tags } });
  }

  return Response.json({ success: true });
}
