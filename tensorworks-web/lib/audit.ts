import { prisma } from "@/lib/prisma";

interface AuditEntry {
  actorEmail: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorEmail: entry.actorEmail,
        action: entry.action,
        target: entry.target,
        metadata: entry.metadata as object | undefined,
        ipAddress: entry.ipAddress,
      },
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}
