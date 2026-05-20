import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { subscribeContact, tagContact } from "@/lib/mailchimp";

interface ImportRow {
  email: string;
  firstName?: string;
  lastName?: string;
  organisation?: string;
  roleTitle?: string;
  consentNote: string;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const body = await req.json() as { rows: ImportRow[] };
  if (!Array.isArray(body.rows)) {
    return Response.json({ error: "rows array required" }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of body.rows) {
    try {
      const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: row.email } });
      if (existing) { skipped++; continue; }

      const record = await prisma.newsletterSubscriber.create({
        data: {
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          organisation: row.organisation,
          roleTitle: row.roleTitle,
          consentBasis: "inferred_business",
          consentSource: "manual_import",
          consentNote: row.consentNote,
          tags: ["cold_outbound"],
          status: "active",
        },
      });

      // Sync to Mailchimp (non-fatal if it fails)
      try {
        const mcId = await subscribeContact({
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          tags: ["cold_outbound"],
          status: "subscribed",
        });
        await prisma.newsletterSubscriber.update({
          where: { id: record.id },
          data: { mailchimpId: mcId },
        });
      } catch (mcErr) {
        // Log but don't fail the import
        errors.push(`Mailchimp sync failed for ${row.email}: ${String(mcErr)}`);
      }

      imported++;
    } catch (err) {
      errors.push(`Failed to import ${row.email}: ${String(err)}`);
      skipped++;
    }
  }

  await logAudit({
    actorEmail: user,
    action: "subscriber.import",
    metadata: { imported, skipped, total: body.rows.length },
  });

  return Response.json({ imported, skipped, errors });
}
