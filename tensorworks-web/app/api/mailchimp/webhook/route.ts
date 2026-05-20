import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";

// Mailchimp sends a GET request as a verification ping — just return 200
export async function GET(_request: NextRequest) {
  return new Response("OK", { status: 200 });
}

// Mailchimp sends webhook events as application/x-www-form-urlencoded
export async function POST(request: NextRequest) {
  // Optional webhook secret verification via URL param
  if (env.MAILCHIMP_WEBHOOK_SECRET) {
    const { searchParams } = new URL(request.url);
    const incomingSecret = searchParams.get("secret");
    if (incomingSecret !== env.MAILCHIMP_WEBHOOK_SECRET) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  let params: URLSearchParams;
  try {
    const rawBody = await request.text();
    params = new URLSearchParams(rawBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const type = params.get("type");

  try {
    switch (type) {
      case "subscribe": {
        await handleSubscribe(params);
        break;
      }
      case "unsubscribe": {
        await handleUnsubscribe(params);
        break;
      }
      case "cleaned": {
        await handleCleaned(params);
        break;
      }
      case "profile": {
        await handleProfile(params);
        break;
      }
      case "upemail": {
        await handleUpEmail(params);
        break;
      }
      case "campaign":
      default:
        // Ignore campaign events and unknown types
        break;
    }
  } catch (err) {
    console.error(`Mailchimp webhook error for type="${type}":`, err);
    // Always return 200 so Mailchimp doesn't retry in a loop
  }

  return new Response("OK", { status: 200 });
}

// ─── Event handlers ────────────────────────────────────────────────────────────

async function handleSubscribe(params: URLSearchParams): Promise<void> {
  const email = params.get("data[email]") ?? "";
  if (!email) return;

  await prisma.newsletterSubscriber.updateMany({
    where: { email },
    data: {
      status: "active",
      doubleOptInConfirmedAt: new Date(),
    },
  });
}

async function handleUnsubscribe(params: URLSearchParams): Promise<void> {
  const email = params.get("data[email]") ?? "";
  if (!email) return;

  await prisma.newsletterSubscriber.updateMany({
    where: { email },
    data: {
      status: "unsubscribed",
      unsubscribedAt: new Date(),
      unsubscribeReason: "mailchimp_webhook",
    },
  });

  await logAudit({
    actorEmail: email,
    action: "newsletter.unsubscribe",
    target: email,
    metadata: { source: "mailchimp_webhook" },
  });
}

async function handleCleaned(params: URLSearchParams): Promise<void> {
  const email = params.get("data[email]") ?? "";
  if (!email) return;

  // reason from Mailchimp: "hard" or "soft"
  const reason = params.get("data[reason]") ?? "";
  const bounceType = reason === "hard" || reason === "soft" ? reason : "hard";

  await prisma.newsletterSubscriber.updateMany({
    where: { email },
    data: {
      status: "bounced",
      bouncedAt: new Date(),
      bounceType,
    },
  });
}

async function handleProfile(params: URLSearchParams): Promise<void> {
  const email = params.get("data[email]") ?? "";
  if (!email) return;

  const firstName = params.get("data[merges][FNAME]");
  const lastName = params.get("data[merges][LNAME]");

  const updateData: Record<string, string> = {};
  if (firstName !== null) updateData.firstName = firstName;
  if (lastName !== null) updateData.lastName = lastName;

  if (Object.keys(updateData).length === 0) return;

  await prisma.newsletterSubscriber.updateMany({
    where: { email },
    data: updateData,
  });
}

async function handleUpEmail(params: URLSearchParams): Promise<void> {
  const oldEmail = params.get("data[old_email]") ?? "";
  const newEmail = params.get("data[new_email]") ?? "";
  if (!oldEmail || !newEmail || oldEmail === newEmail) return;

  // Check that a record with the old email exists before attempting update
  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email: oldEmail },
  });
  if (!existing) return;

  // Ensure no collision with the new email
  const collision = await prisma.newsletterSubscriber.findUnique({
    where: { email: newEmail },
  });
  if (collision) {
    console.warn(
      `Mailchimp upemail: new email ${newEmail} already exists in DB — skipping update from ${oldEmail}`
    );
    return;
  }

  await prisma.newsletterSubscriber.update({
    where: { email: oldEmail },
    data: { email: newEmail },
  });
}
