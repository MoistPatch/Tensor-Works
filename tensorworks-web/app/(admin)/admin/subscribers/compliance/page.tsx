import { prisma } from "@/lib/prisma";

export const metadata = { title: "Compliance — TensorWorks Admin" };

const CONSENT_LABELS: Record<string, string> = {
  express: "Express",
  inferred_business: "Inferred (business)",
  inferred_rfq: "Inferred (RFQ)",
  deemed_published: "Deemed published",
};

export default async function CompliancePage() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [consentCounts, suppressionCounts] = await Promise.all([
    // Group by consent basis using raw aggregation
    prisma.newsletterSubscriber.groupBy({
      by: ["consentBasis"],
      _count: { _all: true },
      orderBy: { _count: { consentBasis: "desc" } },
    }),
    // Suppressions in last 30 days
    Promise.all([
      prisma.newsletterSubscriber.count({
        where: { status: "unsubscribed", unsubscribedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.newsletterSubscriber.count({
        where: { status: "bounced", bouncedAt: { gte: thirtyDaysAgo } },
      }),
      prisma.newsletterSubscriber.count({
        where: { status: "complained", complainedAt: { gte: thirtyDaysAgo } },
      }),
    ]),
  ]);

  const [unsubscribed30d, bounced30d, complained30d] = suppressionCounts;
  const totalSuppressions = unsubscribed30d + bounced30d + complained30d;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Compliance</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">
          Consent basis summary and suppression statistics for regulatory compliance.
        </p>
      </div>

      {/* Consent basis table */}
      <div className="bg-white rounded-xl border border-[var(--tw-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
          <h2 className="text-sm font-semibold text-[var(--tw-dark)]">Subscribers by consent basis</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Consent basis</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--tw-muted)]">Count</th>
            </tr>
          </thead>
          <tbody>
            {consentCounts.length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-[var(--tw-muted)]">
                  No subscribers yet.
                </td>
              </tr>
            ) : (
              consentCounts.map((row) => (
                <tr
                  key={row.consentBasis}
                  className="border-b border-[var(--tw-border)] last:border-0"
                >
                  <td className="px-4 py-3 text-[var(--tw-dark)]">
                    {CONSENT_LABELS[row.consentBasis] ?? row.consentBasis}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-[var(--tw-dark)]">
                    {row._count._all.toLocaleString("en-AU")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Suppressions in last 30 days */}
      <div className="bg-white rounded-xl border border-[var(--tw-border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
          <h2 className="text-sm font-semibold text-[var(--tw-dark)]">Suppressions — last 30 days</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Type</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--tw-muted)]">Count</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--tw-border)]">
              <td className="px-4 py-3 text-[var(--tw-dark)]">Unsubscribed</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium text-[var(--tw-dark)]">
                {unsubscribed30d.toLocaleString("en-AU")}
              </td>
            </tr>
            <tr className="border-b border-[var(--tw-border)]">
              <td className="px-4 py-3 text-[var(--tw-dark)]">Bounced</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium text-[var(--tw-dark)]">
                {bounced30d.toLocaleString("en-AU")}
              </td>
            </tr>
            <tr className="border-b border-[var(--tw-border)]">
              <td className="px-4 py-3 text-[var(--tw-dark)]">Complained</td>
              <td className="px-4 py-3 text-right tabular-nums font-medium text-[var(--tw-dark)]">
                {complained30d.toLocaleString("en-AU")}
              </td>
            </tr>
            <tr>
              <td className="px-4 py-3 font-semibold text-[var(--tw-dark)]">Total</td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-[var(--tw-dark)]">
                {totalSuppressions.toLocaleString("en-AU")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Ad-hoc export */}
      <div className="bg-white rounded-xl border border-[var(--tw-border)] p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--tw-dark)]">Compliance export</h2>
          <p className="text-xs text-[var(--tw-muted)] mt-1">
            Generate a full subscriber data export for audit or regulatory purposes.
          </p>
        </div>

        <form
          action="/api/admin/subscribers/compliance/export"
          method="POST"
        >
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[var(--tw-dark)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Generate ad-hoc export
          </button>
        </form>

        <div className="pt-3 border-t border-[var(--tw-border)]">
          <h3 className="text-xs font-semibold text-[var(--tw-dark)] mb-2">Past exports</h3>
          <p className="text-xs text-[var(--tw-muted)]">
            No exports yet. Configure S3 backup settings to enable automated exports.
          </p>
        </div>
      </div>
    </div>
  );
}
