import { Job } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function processConsentAuditExport(_job: Job): Promise<void> {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  logger.info({ month: monthKey }, "Starting consent audit export");

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

  const jsonContent = JSON.stringify(subscribers, null, 2);

  const csvHeader =
    "id,email,consentBasis,consentSource,consentTimestamp,consentIp,consentNote,status,unsubscribedAt,bouncedAt,complainedAt,createdAt\n";
  const csvRows = subscribers
    .map((s) =>
      [
        s.id,
        s.email,
        s.consentBasis,
        s.consentSource,
        s.consentTimestamp?.toISOString() ?? "",
        s.consentIp ?? "",
        `"${(s.consentNote ?? "").replace(/"/g, '""')}"`,
        s.status,
        s.unsubscribedAt?.toISOString() ?? "",
        s.bouncedAt?.toISOString() ?? "",
        s.complainedAt?.toISOString() ?? "",
        s.createdAt.toISOString(),
      ].join(",")
    )
    .join("\n");
  const csvContent = csvHeader + csvRows;

  const s3Endpoint = process.env.BACKUP_S3_ENDPOINT;
  const s3Bucket = process.env.BACKUP_S3_BUCKET;
  const s3AccessKey = process.env.BACKUP_S3_ACCESS_KEY;
  const s3SecretKey = process.env.BACKUP_S3_SECRET_KEY;

  if (s3Endpoint && s3Bucket && s3AccessKey && s3SecretKey) {
    // S3/B2 upload — requires @aws-sdk/client-s3
    try {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      const s3 = new S3Client({
        endpoint: s3Endpoint,
        region: "auto",
        credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
      });

      await s3.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: `consent-exports/${monthKey}.json`,
          Body: jsonContent,
          ContentType: "application/json",
        })
      );
      await s3.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: `consent-exports/${monthKey}.csv`,
          Body: csvContent,
          ContentType: "text/csv",
        })
      );
      logger.info({ monthKey, bucket: s3Bucket }, "Consent export uploaded to S3");
    } catch (err) {
      logger.error({ err }, "S3 upload failed — falling back to local file");
      await writeLocalExport(monthKey, jsonContent, csvContent);
    }
  } else {
    // Write locally
    await writeLocalExport(monthKey, jsonContent, csvContent);
  }

  logger.info({ monthKey, count: subscribers.length }, "Consent audit export complete");
}

async function writeLocalExport(monthKey: string, json: string, csv: string) {
  const exportsDir = join(process.cwd(), "exports");
  await mkdir(exportsDir, { recursive: true });
  await writeFile(join(exportsDir, `${monthKey}-consent.json`), json, "utf-8");
  await writeFile(join(exportsDir, `${monthKey}-consent.csv`), csv, "utf-8");
  logger.info({ dir: exportsDir, monthKey }, "Consent export written locally");
}

export const consentAuditExportProcessor = processConsentAuditExport;
