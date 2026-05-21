import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { subscribeContact, tagContact } from "@/lib/mailchimp";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  consent: z.literal(true, { error: "Consent is required" }),
});

const GENERIC_RESPONSE = { message: "Check your email to confirm your subscription." };

export async function POST(request: NextRequest) {
  // Extract IP
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    const consentIssue = parsed.error.issues.find((i) =>
      i.path.includes("consent")
    );
    if (consentIssue) {
      return Response.json({ error: "Consent is required to subscribe." }, { status: 400 });
    }
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const { email } = parsed.data;

  // Check for existing subscriber
  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email },
  });

  if (existing) {
    if (existing.status === "active") {
      // Don't distinguish from success to prevent email enumeration
      return Response.json(GENERIC_RESPONSE, { status: 200 });
    }

    if (existing.status === "pending") {
      // Resend confirmation by triggering double opt-in again
      try {
        await subscribeContact({ email, status: "pending", tags: ["newsletter_signup"] });
      } catch (err) {
        console.error("Mailchimp re-pending failed:", err);
      }
      return Response.json(GENERIC_RESPONSE, { status: 200 });
    }

    if (existing.status === "unsubscribed") {
      // Re-subscribe: reset consent info and status
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: {
          status: "pending",
          consentTimestamp: new Date(),
          consentIp: ip,
          unsubscribedAt: null,
          unsubscribeReason: null,
        },
      });

      try {
        await subscribeContact({ email, status: "pending", tags: ["newsletter_signup"] });
      } catch (err) {
        console.error("Mailchimp re-subscribe failed:", err);
      }

      return Response.json(GENERIC_RESPONSE, { status: 200 });
    }
  }

  // New subscriber
  await prisma.newsletterSubscriber.create({
    data: {
      email,
      status: "pending",
      consentBasis: "express",
      consentSource: "form_blog_footer",
      consentTimestamp: new Date(),
      consentIp: ip,
      tags: ["newsletter_signup"],
    },
  });

  try {
    await subscribeContact({
      email,
      status: "pending",
      tags: ["newsletter_signup"],
    });
  } catch (err) {
    console.error("Mailchimp subscribeContact failed:", err);
    // Don't fail the request — subscriber is recorded locally
  }

  return Response.json(GENERIC_RESPONSE, { status: 200 });
}
