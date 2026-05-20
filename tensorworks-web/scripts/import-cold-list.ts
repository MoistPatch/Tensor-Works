/**
 * Cold list CSV import script.
 * Usage: pnpm import:cold ./path/to/contacts.csv
 *
 * Required CSV columns:
 *   email, first_name, last_name, organisation, role_title,
 *   role_source_url, role_relevance_note
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import mailchimp from "@mailchimp/mailchimp_marketing";
import { createHash } from "crypto";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: pnpm import:cold ./contacts.csv");
  process.exit(1);
}

const apiKey = process.env.MAILCHIMP_API_KEY;
const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;

if (apiKey && serverPrefix) {
  mailchimp.setConfig({ apiKey, server: serverPrefix });
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface ParsedRow {
  email: string;
  first_name: string;
  last_name: string;
  organisation: string;
  role_title: string;
  role_source_url: string;
  role_relevance_note: string;
}

function parseCsv(content: string): ParsedRow[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const values = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = values[i]?.trim() ?? "";
      });
      return row as unknown as ParsedRow;
    });
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

async function main() {
  const content = readFileSync(csvPath, "utf-8");
  const rows = parseCsv(content);

  console.log(`Parsed ${rows.length} rows from ${csvPath}`);

  let imported = 0;
  let skipped = 0;
  const rejected: Array<ParsedRow & { rejection_reason: string }> = [];

  for (const row of rows) {
    // Validation
    if (!isValidEmail(row.email)) {
      rejected.push({ ...row, rejection_reason: "Invalid email format" });
      skipped++;
      continue;
    }
    if (!isValidUrl(row.role_source_url)) {
      rejected.push({ ...row, rejection_reason: "role_source_url missing or not a URL" });
      skipped++;
      continue;
    }
    if (!row.role_relevance_note || row.role_relevance_note.length < 20) {
      rejected.push({ ...row, rejection_reason: "role_relevance_note missing or too short (min 20 chars)" });
      skipped++;
      continue;
    }

    // Duplicate check
    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email: row.email } });
    if (existing) {
      rejected.push({ ...row, rejection_reason: "Already exists in database" });
      skipped++;
      continue;
    }

    // Create subscriber
    try {
      const record = await prisma.newsletterSubscriber.create({
        data: {
          email: row.email,
          firstName: row.first_name || undefined,
          lastName: row.last_name || undefined,
          organisation: row.organisation || undefined,
          roleTitle: row.role_title || undefined,
          consentBasis: "inferred_business",
          consentSource: "manual_import",
          consentNote: `${row.role_source_url} | ${row.role_relevance_note}`,
          tags: ["cold_outbound"],
          status: "active",
        },
      });

      // Sync to Mailchimp
      if (apiKey && audienceId) {
        try {
          const hash = createHash("md5").update(row.email.toLowerCase()).digest("hex");
          await (mailchimp as any).lists.setListMember(audienceId, hash, {
            email_address: row.email,
            status_if_new: "subscribed",
            status: "subscribed",
            merge_fields: {
              FNAME: row.first_name,
              LNAME: row.last_name,
            },
            tags: [{ name: "cold_outbound", status: "active" }],
          });

          const mcResp = await (mailchimp as any).lists.getListMember(audienceId, hash);
          await prisma.newsletterSubscriber.update({
            where: { id: record.id },
            data: { mailchimpId: String(mcResp.web_id) },
          });
        } catch (mcErr) {
          console.warn(`  Mailchimp sync failed for ${row.email}:`, mcErr);
        }
      }

      imported++;
      if (imported % 10 === 0) console.log(`  Imported ${imported} records...`);
    } catch (err) {
      rejected.push({ ...row, rejection_reason: `DB error: ${String(err)}` });
      skipped++;
    }
  }

  // Write outputs
  const summary = {
    total: rows.length,
    imported,
    skipped,
    rejectedCount: rejected.length,
    timestamp: new Date().toISOString(),
    source: csvPath,
  };

  writeFileSync("import-summary.json", JSON.stringify(summary, null, 2));

  if (rejected.length > 0) {
    const rejCsvHeader = "email,first_name,last_name,organisation,role_title,role_source_url,role_relevance_note,rejection_reason\n";
    const rejCsvRows = rejected
      .map((r) =>
        [r.email, r.first_name, r.last_name, r.organisation, r.role_title,
         r.role_source_url, `"${r.role_relevance_note}"`, `"${r.rejection_reason}"`].join(",")
      )
      .join("\n");
    writeFileSync("rejected.csv", rejCsvHeader + rejCsvRows);
    console.log(`\n${rejected.length} rows rejected — see rejected.csv`);
  }

  console.log(`\nDone. Imported: ${imported}, Skipped/rejected: ${skipped}`);
  console.log("Summary written to import-summary.json");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
