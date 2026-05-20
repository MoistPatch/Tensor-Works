import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata = { title: "Editorial Calendar — TensorWorks Admin" };

const TIER_LABELS: Record<string, string> = {
  "deep-analysis": "Deep Analysis",
  "weekly-digest": "Weekly Digest",
  "daily-scan": "Daily Scan",
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  assigned: "Assigned",
  generated: "Generated",
  skipped: "Skipped",
};

const STATUS_ORDER = ["queued", "assigned", "generated", "skipped"] as const;
type CalendarStatus = (typeof STATUS_ORDER)[number];

function TierBadge({ tier }: { tier: string }) {
  if (tier === "deep-analysis") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-blue)] text-white">
        {TIER_LABELS[tier] ?? tier}
      </span>
    );
  }
  if (tier === "weekly-digest") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-green)] text-white">
        {TIER_LABELS[tier] ?? tier}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-200 text-[var(--tw-dark)]">
      {TIER_LABELS[tier] ?? tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    queued: "bg-amber-100 text-amber-700",
    assigned: "bg-blue-100 text-blue-700",
    generated: "bg-green-100 text-green-700",
    skipped: "bg-gray-100 text-gray-500",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[status] ?? "bg-gray-100 text-gray-500"}`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default async function EditorialCalendarPage() {
  const entries = await prisma.editorialCalendar.findMany({
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  // Group by status
  const grouped = STATUS_ORDER.reduce(
    (acc, s) => {
      acc[s] = entries.filter((e) => e.status === s);
      return acc;
    },
    {} as Record<CalendarStatus, typeof entries>
  );

  const totalCount = entries.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Editorial Calendar</h1>
          <p className="text-sm text-[var(--tw-muted)] mt-1">{totalCount} topics</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/content"
            className="text-sm text-[var(--tw-muted)] hover:text-[var(--tw-dark)] transition-colors"
          >
            ← Content Queue
          </Link>
          <Link
            href="/admin/content/calendar/new"
            className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium bg-[var(--tw-blue)] text-white hover:opacity-90 transition-opacity"
          >
            + Add topic
          </Link>
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="bg-white rounded-xl border border-[var(--tw-border)] px-4 py-16 text-center text-[var(--tw-muted)]">
          No editorial topics found.
        </div>
      ) : (
        <div className="space-y-8">
          {STATUS_ORDER.map((statusKey) => {
            const group = grouped[statusKey];
            if (group.length === 0) return null;

            return (
              <div key={statusKey}>
                <div className="flex items-center gap-2 mb-3">
                  <StatusBadge status={statusKey} />
                  <span className="text-sm text-[var(--tw-muted)]">
                    {group.length} {group.length === 1 ? "topic" : "topics"}
                  </span>
                </div>

                <div className="bg-white rounded-xl border border-[var(--tw-border)] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
                        <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                          Topic
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">
                          Category
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">
                          Tier
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden xl:table-cell">
                          Target week
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">
                          Priority
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">
                          Override
                        </th>
                        <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-[var(--tw-dark)] line-clamp-1">
                              {entry.topic}
                            </p>
                            {entry.description && (
                              <p className="text-xs text-[var(--tw-muted)] mt-0.5 line-clamp-1">
                                {entry.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[var(--tw-mid)] capitalize hidden lg:table-cell">
                            {entry.category}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <TierBadge tier={entry.tier} />
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--tw-muted)] whitespace-nowrap hidden xl:table-cell">
                            {entry.targetWeek
                              ? new Date(entry.targetWeek).toLocaleDateString("en-AU")
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-[var(--tw-muted)] hidden lg:table-cell">
                            {entry.priority}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {entry.adminOverride ? (
                              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-blue)] text-white">
                                Override
                              </span>
                            ) : (
                              <span className="text-[var(--tw-muted)] text-xs">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {statusKey === "queued" && (
                              <form
                                action={`/api/admin/content/calendar/${entry.id}/override`}
                                method="POST"
                              >
                                <button
                                  type="submit"
                                  className="text-xs text-[var(--tw-blue)] hover:underline font-medium"
                                >
                                  Set override
                                </button>
                              </form>
                            )}
                            {entry.postId && (
                              <Link
                                href={`/admin/content/${entry.postId}`}
                                className="text-xs text-[var(--tw-blue)] hover:underline font-medium ml-2"
                              >
                                View post
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
