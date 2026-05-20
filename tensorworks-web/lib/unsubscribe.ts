import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import { env } from "@/lib/env";

// Generate a 32-byte hex unsubscribe token for an email, store in DB (365 day expiry)
export async function generateUnsubscribeToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  await prisma.unsubscribeToken.create({
    data: {
      email,
      token,
      expiresAt,
    },
  });

  return token;
}

// Verify token and return the email it belongs to (null if invalid/used/expired)
export async function verifyUnsubscribeToken(
  token: string
): Promise<string | null> {
  if (!token) return null;

  const record = await prisma.unsubscribeToken.findUnique({
    where: { token },
  });

  if (!record) return null;
  if (record.used) return null;
  if (record.expiresAt < new Date()) return null;

  return record.email;
}

// Mark token used
export async function consumeUnsubscribeToken(token: string): Promise<void> {
  await prisma.unsubscribeToken.update({
    where: { token },
    data: { used: true },
  });
}

// Build the full unsubscribe URL for a given email
export function buildUnsubscribeUrl(email: string, token: string): string {
  return `${env.NEXT_PUBLIC_SITE_URL}/api/newsletter/unsubscribe?token=${token}`;
}
