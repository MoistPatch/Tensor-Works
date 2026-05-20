import { prisma } from "@/lib/prisma";

export const metadata = { title: "Audit Log — TensorWorks Admin" };

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function AuditLogPage({ searchParams }: Props) {
  const { page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = 50;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Audit Log</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">{total} entries</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--tw-border)] overflow-hidden">
        <table className="w-full text-sm font-mono">
          <thead>
            <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
              <th className="text-left px-4 py-3 font-medium font-sans text-[var(--tw-muted)]">Time</th>
              <th className="text-left px-4 py-3 font-medium font-sans text-[var(--tw-muted)]">Actor</th>
              <th className="text-left px-4 py-3 font-medium font-sans text-[var(--tw-muted)]">Action</th>
              <th className="text-left px-4 py-3 font-medium font-sans text-[var(--tw-muted)] hidden lg:table-cell">Target</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-[var(--tw-muted)] font-sans">
                  No audit log entries.
                </td>
              </tr>
            ) : (
              logs.map((log: { id: string; actorEmail: string; action: string; target: string | null; createdAt: Date }) => (
                <tr
                  key={log.id}
                  className="border-b border-[var(--tw-border)] last:border-0 text-xs"
                >
                  <td className="px-4 py-2.5 text-[var(--tw-muted)] whitespace-nowrap">
                    {new Date(log.createdAt).toISOString()}
                  </td>
                  <td className="px-4 py-2.5 text-[var(--tw-dark)]">{log.actorEmail}</td>
                  <td className="px-4 py-2.5 text-[var(--tw-blue)]">{log.action}</td>
                  <td className="px-4 py-2.5 text-[var(--tw-muted)] hidden lg:table-cell">
                    {log.target ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
