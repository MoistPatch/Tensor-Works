import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import {
  verifyUnsubscribeToken,
  consumeUnsubscribeToken,
} from "@/lib/unsubscribe";
import { unsubscribeContact } from "@/lib/mailchimp";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";

  if (!token) {
    redirect("/unsubscribed?reason=invalid");
  }

  const email = await verifyUnsubscribeToken(token);

  if (!email) {
    redirect("/unsubscribed?reason=invalid");
  }

  // Consume the token so it can't be reused
  await consumeUnsubscribeToken(token);

  // Update subscriber record in our DB
  await prisma.newsletterSubscriber.updateMany({
    where: { email },
    data: {
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      unsubscribeReason: "one_click_link",
    },
  });

  // Unsubscribe in Mailchimp — catch errors gracefully so the user still lands on the success page
  try {
    await unsubscribeContact(email);
  } catch (err) {
    console.error("Mailchimp unsubscribeContact failed during one-click unsubscribe:", err);
  }

  // Audit log
  await logAudit({
    actorEmail: email,
    action: "newsletter.unsubscribe",
    target: email,
    metadata: { method: "one_click_link" },
  });

  redirect("/unsubscribed");
}
