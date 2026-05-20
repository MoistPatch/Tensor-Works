import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "Subscribers — TensorWorks Admin" };

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "bounced", label: "Bounced" },
  { value: "complained", label: "Complained" },
];

const TAG_OPTIONS = [
  { value: "", label: "All tags" },
  { value: "newsletter_signup", label: "Newsletter signup" },
  { value: "cold_outbound", label: "Cold outbound" },
  { value: "rfq_submitter", label: "RFQ submitter" },
  { value: "customer", label: "Customer" },
];

const CONSENT_OPTIONS = [
  { value: "", label: "All consent bases" },
  { value: "express", label: "Express" },
  { value: "inferred_business", label: "Inferred (business)" },
  { value: "inferred_rfq", label: "Inferred (RFQ)" },
  { value: "deemed_published", label: "Deemed published" },
];

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    active: "bg-green-100 text-green-700",
    unsubscribed: "bg-gray-200 text-[var(--tw-muted)]",
    bounced: "bg-red-100 text-red-700",
    complained: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    active: "Active",
    unsubscribed: "Unsubscribed",
    bounced: "Bounced",
    complained: "Complained",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[status] ?? "bg-gray-100 text-[var(--tw-muted)]"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function ConsentBadge({ basis }: { basis: string }) {
  const classes: Record<string, string> = {
    express: "bg-green-100 text-green-700",
    inferred_business: "bg-[var(--tw-blue)] text-white",
    inferred_rfq: "bg-[var(--tw-blue)] text-white",
    deemed_published: "bg-gray-200 text-[var(--tw-muted)]",
  };
  const labels: Record<string, string> = {
    express: "Express",
    inferred_business: "Inferred (business)",
    inferred_rfq: "Inferred (RFQ)",
    deemed_published: "Deemed published",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[basis] ?? "bg-gray-100 text-[var(--tw-muted)]"}`}
    >
      {labels[basis] ?? basis}
    </span>
  );
}

interface Props {
  searchParams: Promise<{
    page?: string;
    status?: string;
    tag?: string;
    consentBasis?: string;
  }>;
}

export default async function SubscribersPage({ searchParams }: Props) {
  const { page, status, tag, consentBasis } = await searchParams;

  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (tag) where.tags = { has: tag };
  if (consentBasis) where.consentBasis = consentBasis;

  const [subscribers, total, stats] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        tags: true,
        consentBasis: true,
        consentTimestamp: true,
        lastEngagedAt: true,
      },
    }),
    prisma.newsletterSubscriber.count({ where }),
    Promise.all(
      ["active", "unsubscribed", "bounced"].map((s) =>
        prisma.newsletterSubscriber.count({ where: { status: s } }).then((c) => [s, c] as const)
      )
    ),
  ]);

  const statMap = Object.fromEntries(stats);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Build query string helper for pagination links
  const buildQuery = (p: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (tag) params.set("tag", tag);
    if (consentBasis) params.set("consentBasis", consentBasis);
    params.set("page", String(p));
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Subscribers</h1>
          <p className="text-sm text-[var(--tw-muted)] mt-1">
            {total.toLocaleString("en-AU")} total ·{" "}
            {statMap.active?.toLocaleString("en-AU") ?? 0} active ·{" "}
            {statMap.unsubscribed?.toLocaleString("en-AU") ?? 0} unsubscribed ·{" "}
            {statMap.bounced?.toLocaleString("en-AU") ?? 0} bounced
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/subscribers/compliance"
            className="text-sm text-[var(--tw-muted)] hover:text-[var(--tw-dark)] transition-colors"
          >
            Compliance →
          </Link>
          <Link
            href="/admin/subscribers/import"
            className="px-4 py-2 rounded-lg bg-[var(--tw-blue)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Import CSV
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-[var(--tw-border)] px-3 py-2 text-sm text-[var(--tw-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          name="tag"
          defaultValue={tag ?? ""}
          className="rounded-lg border border-[var(--tw-border)] px-3 py-2 text-sm text-[var(--tw-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)]"
        >
          {TAG_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          name="consentBasis"
          defaultValue={consentBasis ?? ""}
          className="rounded-lg border border-[var(--tw-border)] px-3 py-2 text-sm text-[var(--tw-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)]"
        >
          {CONSENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-[var(--tw-dark)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Filter
        </button>

        {(status || tag || consentBasis) && (
          <Link
            href="/admin/subscribers"
            className="px-4 py-2 rounded-lg border border-[var(--tw-border)] text-sm text-[var(--tw-muted)] hover:text-[var(--tw-dark)] transition-colors"
          >
            Clear filters
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[var(--tw-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Email</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Status</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">Tags</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">Consent basis</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden xl:table-cell">Consent date</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden xl:table-cell">Last engaged</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--tw-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--tw-muted)]">
                  No subscribers found.
                </td>
              </tr>
            ) : (
              subscribers.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <span className="font-medium text-[var(--tw-dark)] truncate max-w-xs block">
                      {sub.email}
                    </span>
                    {(sub.firstName || sub.lastName) && (
                      <span className="text-xs text-[var(--tw-muted)]">
                        {[sub.firstName, sub.lastName].filter(Boolean).join(" ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {sub.tags.length > 0
                        ? sub.tags.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-[var(--tw-mid)]"
                            >
                              {t}
                            </span>
                          ))
                        : <span className="text-xs text-[var(--tw-muted)]">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <ConsentBadge basis={sub.consentBasis} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--tw-muted)] whitespace-nowrap hidden xl:table-cell">
                    {new Date(sub.consentTimestamp).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--tw-muted)] whitespace-nowrap hidden xl:table-cell">
                    {sub.lastEngagedAt
                      ? new Date(sub.lastEngagedAt).toLocaleDateString("en-AU")
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/subscribers?view=${sub.id}&page=${currentPage}${status ? `&status=${status}` : ""}${tag ? `&tag=${tag}` : ""}${consentBasis ? `&consentBasis=${consentBasis}` : ""}`}
                      className="text-xs text-[var(--tw-blue)] hover:underline font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-[var(--tw-muted)]">
          <span>
            Page {currentPage} of {totalPages} · {total.toLocaleString("en-AU")} records
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={buildQuery(currentPage - 1)}
                className="px-3 py-1.5 rounded-lg border border-[var(--tw-border)] hover:bg-[var(--tw-bg)] transition-colors text-[var(--tw-dark)]"
              >
                ← Previous
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={buildQuery(currentPage + 1)}
                className="px-3 py-1.5 rounded-lg border border-[var(--tw-border)] hover:bg-[var(--tw-bg)] transition-colors text-[var(--tw-dark)]"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
