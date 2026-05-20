import { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  await consumeUnsubscribeToken(token);

  await prisma.newsletterSubscriber.updateMany({
    where: { email },
    data: {
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      unsubscribeReason: "one_click_link",
    },
  });

  try {
    await unsubscribeContact(email);
  } catch (err) {
    console.error("Mailchimp unsubscribeContact failed:", err);
  }

  redirect("/unsubscribed");
}

