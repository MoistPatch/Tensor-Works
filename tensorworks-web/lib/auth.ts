import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { randomBytes, createHmac } from "crypto";
import { logAudit } from "@/lib/audit";

const SESSION_COOKIE = "tw_admin_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAGIC_LINK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function isAdminEmail(email: string): boolean {
  const allowed = env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase());
  return allowed.includes(email.toLowerCase());
}

export async function issueMagicLink(email: string): Promise<string> {
  if (!isAdminEmail(email)) {
    throw new Error("Email not authorised");
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAGIC_LINK_DURATION_MS);

  await prisma.magicLinkToken.create({
    data: { email, token, expiresAt },
  });

  return token;
}

export async function verifyMagicLink(
  token: string,
  ipAddress?: string
): Promise<{ email: string; sessionToken: string } | null> {
  const record = await prisma.magicLinkToken.findUnique({ where: { token } });

  if (!record || record.used || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.magicLinkToken.update({
    where: { id: record.id },
    data: { used: true },
  });

  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.adminSession.create({
    data: { email: record.email, token: sessionToken, expiresAt },
  });

  await logAudit({
    actorEmail: record.email,
    action: "admin.login",
    ipAddress,
  });

  return { email: record.email, sessionToken };
}

export async function createSession(sessionToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function getSessionUser(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.adminSession.findUnique({ where: { token } });
  if (!session || session.expiresAt < new Date()) return null;

  return session.email;
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.adminSession.deleteMany({ where: { token } });
    cookieStore.delete(SESSION_COOKIE);
  }
}
