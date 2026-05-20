import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { issueMagicLink, verifyMagicLink, createSession, deleteSession } from "@/lib/auth";
import { sendMagicLink } from "@/lib/resend-admin";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { email } = body as { email?: string };
  if (!email || typeof email !== "string") {
    return Response.json({ error: "Email required" }, { status: 400 });
  }

  const headerStore = await headers();
  const ip = headerStore.get("cf-connecting-ip") ?? headerStore.get("x-forwarded-for") ?? "unknown";

  try {
    const token = await issueMagicLink(email);
    await sendMagicLink(email, token);
  } catch (err) {
    if ((err as Error).message === "Email not authorised") {
      return Response.json({ success: true });
    }
    return Response.json({ error: "Failed to send login link" }, { status: 500 });
  }

  return Response.json({ success: true });
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return Response.json({ error: "Token required" }, { status: 400 });
  }

  const headerStore = await headers();
  const ip = headerStore.get("cf-connecting-ip") ?? headerStore.get("x-forwarded-for") ?? "unknown";

  const result = await verifyMagicLink(token, ip);
  if (!result) {
    return Response.redirect(new URL("/admin/auth/login?error=invalid", req.url));
  }

  await createSession(result.sessionToken);
  return Response.redirect(new URL("/admin", req.url));
}

export async function DELETE() {
  await deleteSession();
  return Response.json({ success: true });
}
