import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const subscribers = await prisma.newsletterSubscriber.findMany({
    select: {
      id: true,
      email: true,
      consentBasis: true,
      consentSource: true,
      consentTimestamp: true,
      consentIp: true,
      consentNote: true,
      status: true,
      unsubscribedAt: true,
      bouncedAt: true,
      complainedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const json = JSON.stringify(subscribers, null, 2);

  const csvHeader = "id,email,consentBasis,consentSource,consentTimestamp,consentIp,consentNote,status,unsubscribedAt,bouncedAt,complainedAt,createdAt\n";
  const csvRows = subscribers.map((s) =>
    [s.id, s.email, s.consentBasis, s.consentSource, s.consentTimestamp?.toISOString() ?? "",
     s.consentIp ?? "", `"${(s.consentNote ?? "").replace(/"/g, '""')}"`,
     s.status, s.unsubscribedAt?.toISOString() ?? "", s.bouncedAt?.toISOString() ?? "",
     s.complainedAt?.toISOString() ?? "", s.createdAt.toISOString()].join(",")
  ).join("\n");
  const csv = csvHeader + csvRows;

  return Response.json({
    exportId: `adhoc-${monthKey}-${Date.now()}`,
    recordCount: subscribers.length,
    json,
    csv,
    generatedAt: now.toISOString(),
    generatedBy: user,
  });
}
