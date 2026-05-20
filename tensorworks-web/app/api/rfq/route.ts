import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { rfqFullSchema } from "@/lib/validations/rfq";
import { createHubSpotContact, createHubSpotDeal } from "@/lib/hubspot";
import { sendRFQNotification, sendRFQAcknowledgement } from "@/lib/resend";
import { env } from "@/lib/env";

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
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

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret: env.TURNSTILE_SECRET_KEY,
          response: token,
          remoteip: ip,
        }),
      }
    );
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const headerStore = await headers();
  const ip =
    headerStore.get("cf-connecting-ip") ??
    headerStore.get("x-forwarded-for")?.split(",")[0] ??
    "unknown";
  const userAgent = headerStore.get("user-agent") ?? "";

  if (!checkRateLimit(ip)) {
    return Response.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = rfqFullSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const data = parsed.data;

  const turnstileOk = await verifyTurnstile(data.turnstileToken, ip);
  if (!turnstileOk) {
    return Response.json(
      { error: "Security check failed. Please reload and try again." },
      { status: 400 }
    );
  }

  const submission = await prisma.rFQSubmission.create({
    data: {
      companyName: data.companyName,
      abn: data.abn,
      contactName: data.contactName,
      role: data.role,
      email: data.email,
      phone: data.phone,
      organisationType: data.organisationType,
      useCase: data.useCase,
      budgetBracket: data.budgetBracket,
      timeline: data.timeline,
      specifications: data.specifications ?? "",
      procurementConstraints: data.procurementConstraints,
      referralSource: data.referralSource,
      ipAddress: ip,
      userAgent,
      status: "new",
    },
  });

  const [contactId] = await Promise.allSettled([
    createHubSpotContact(data),
  ]);

  const resolvedContactId =
    contactId.status === "fulfilled" ? contactId.value : null;

  await Promise.allSettled([
    createHubSpotDeal(data, resolvedContactId),
    resolvedContactId &&
      prisma.rFQSubmission.update({
        where: { id: submission.id },
        data: { hubspotContactId: resolvedContactId },
      }),
    sendRFQNotification(data, submission.id),
    sendRFQAcknowledgement(data),
  ]);

  return Response.json({ success: true, id: submission.id }, { status: 201 });
}
