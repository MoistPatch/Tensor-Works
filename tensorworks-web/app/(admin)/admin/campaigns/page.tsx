import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { QuickApproveButton } from "./QuickApproveButton";

export const metadata = { title: "Campaigns — TensorWorks Admin" };

const ALL_STATUSES = ["draft", "in_review", "approved", "scheduled", "sent"] as const;
type CampaignStatus = (typeof ALL_STATUSES)[number];

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  scheduled: "Scheduled",
  sent: "Sent",
};

const TYPE_LABELS: Record<string, string> = {
  weekly_digest_email: "Weekly Digest",
  post_announcement: "Post Announcement",
  cold_intro: "Cold Intro",
  welcome_1: "Welcome 1",
  welcome_2: "Welcome 2",
  welcome_3: "Welcome 3",
  reengagement: "Re-engagement",
  manual_broadcast: "Manual Broadcast",
};

function TypeBadge({ type }: { type: string }) {
  if (type === "weekly_digest_email") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-blue)] text-white">
        {TYPE_LABELS[type] ?? type}
      </span>
    );
  }
  if (type === "post_announcement") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-green)] text-white">
        {TYPE_LABELS[type] ?? type}
      </span>
    );
  }
  if (type === "cold_intro") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
        {TYPE_LABELS[type] ?? type}
      </span>
    );
  }
  if (type.startsWith("welcome_")) {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-200 text-[var(--tw-dark)]">
        {TYPE_LABELS[type] ?? type}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-200 text-[var(--tw-dark)]">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    draft: "bg-gray-100 text-[var(--tw-muted)]",
    in_review: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    scheduled: "bg-[var(--tw-blue)] text-white",
    sent: "bg-[var(--tw-dark)] text-white",
    failed: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    draft: "Draft",
    in_review: "In Review",
    approved: "Approved",
    scheduled: "Scheduled",
    sent: "Sent",
    failed: "Failed",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[status] ?? "bg-gray-100 text-[var(--tw-muted)]"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function CampaignsPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const activeStatus = ALL_STATUSES.includes(status as CampaignStatus)
    ? (status as CampaignStatus)
    : "draft";

  const [campaigns, counts] = await Promise.all([
    prisma.emailCampaign.findMany({
      where: { status: activeStatus },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        subjectLine: true,
        type: true,
        segmentTag: true,
        status: true,
        scheduledFor: true,
        sentAt: true,
        recipientCount: true,
        createdAt: true,
      },
    }),
    Promise.all(
      ALL_STATUSES.map((s) =>
        prisma.emailCampaign.count({ where: { status: s } }).then((count) => [s, count] as const)
      )
    ),
  ]);

  const countMap = Object.fromEntries(counts);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Campaigns</h1>
          <p className="text-sm text-[var(--tw-muted)] mt-1">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} shown</p>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-[var(--tw-border)]">
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/campaigns?status=${s}`}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeStatus === s
                ? "border-[var(--tw-blue)] text-[var(--tw-blue)]"
                : "border-transparent text-[var(--tw-muted)] hover:text-[var(--tw-dark)]"
            }`}
          >
            {STATUS_LABELS[s]}
            <span className="ml-1.5 text-xs bg-gray-100 text-[var(--tw-muted)] rounded-full px-1.5 py-0.5">
              {countMap[s] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[var(--tw-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Subject</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">Type</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">Segment</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Status</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden xl:table-cell">Scheduled / Sent</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--tw-muted)] hidden xl:table-cell">Recipients</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--tw-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--tw-muted)]">
                  No {STATUS_LABELS[activeStatus].toLowerCase()} campaigns.
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => {
                const subject =
                  campaign.subjectLine.length > 60
                    ? campaign.subjectLine.slice(0, 60) + "…"
                    : campaign.subjectLine;
                const dateVal = campaign.sentAt ?? campaign.scheduledFor;
                return (
                  <tr
                    key={campaign.id}
                    className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)] transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/campaigns/${campaign.id}`}
                        className="font-medium text-[var(--tw-dark)] hover:text-[var(--tw-blue)]"
                      >
                        {subject}
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <TypeBadge type={campaign.type} />
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-[var(--tw-mid)]">
                        {campaign.segmentTag}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--tw-muted)] whitespace-nowrap hidden xl:table-cell">
                      {dateVal
                        ? new Date(dateVal).toLocaleDateString("en-AU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--tw-muted)] text-xs hidden xl:table-cell">
                      {campaign.recipientCount != null
                        ? campaign.recipientCount.toLocaleString("en-AU")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {campaign.status === "draft" && (
                          <QuickApproveButton campaignId={campaign.id} />
                        )}
                        <Link
                          href={`/admin/campaigns/${campaign.id}`}
                          className="text-xs text-[var(--tw-blue)] hover:underline font-medium"
                        >
                          Review →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
