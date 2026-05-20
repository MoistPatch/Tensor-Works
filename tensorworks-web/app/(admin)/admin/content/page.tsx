import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Content Queue — TensorWorks Admin" };

const ALL_STATUSES = ["pending_review", "approved", "rejected", "published"] as const;
type ContentStatus = (typeof ALL_STATUSES)[number];

const STATUS_LABELS: Record<string, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  published: "Published",
};

const TIER_LABELS: Record<string, string> = {
  "deep-analysis": "Deep Analysis",
  "weekly-digest": "Weekly Digest",
  "daily-scan": "Daily Scan",
};

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
  if (status === "pending_review") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">
        Pending Review
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">
        Approved
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-700">
        Rejected
      </span>
    );
  }
  if (status === "published") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-blue)] text-white">
        Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-200 text-[var(--tw-dark)]">
      {status}
    </span>
  );
}

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function ContentQueuePage({ searchParams }: Props) {
  const { status } = await searchParams;
  const activeStatus = ALL_STATUSES.includes(status as ContentStatus) ? status : undefined;

  const where = activeStatus ? { status: activeStatus } : { status: { in: [...ALL_STATUSES] } };

  const [posts, counts] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        tier: true,
        category: true,
        wordCount: true,
        status: true,
        createdAt: true,
        generationLog: {
          select: { qualityScore: true },
        },
      },
    }),
    Promise.all(
      ALL_STATUSES.map((s) =>
        prisma.blogPost.count({ where: { status: s } }).then((count) => [s, count] as const)
      )
    ),
  ]);

  const countMap = Object.fromEntries(counts);
  const totalAll = counts.reduce((sum, [, c]) => sum + c, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Content Queue</h1>
          <p className="text-sm text-[var(--tw-muted)] mt-1">{posts.length} posts shown</p>
        </div>
        <Link
          href="/admin/content/calendar"
          className="text-sm text-[var(--tw-blue)] hover:underline"
        >
          Editorial Calendar →
        </Link>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 border-b border-[var(--tw-border)]">
        <Link
          href="/admin/content"
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            !activeStatus
              ? "border-[var(--tw-blue)] text-[var(--tw-blue)]"
              : "border-transparent text-[var(--tw-muted)] hover:text-[var(--tw-dark)]"
          }`}
        >
          All
          <span className="ml-1.5 text-xs bg-gray-100 text-[var(--tw-muted)] rounded-full px-1.5 py-0.5">
            {totalAll}
          </span>
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/content?status=${s}`}
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
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Title</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">Tier</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">Category</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">Words</th>
              <th className="text-right px-4 py-3 font-medium text-[var(--tw-muted)] hidden xl:table-cell">Quality</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">Generated</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Status</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--tw-muted)]">
                  No posts found.
                </td>
              </tr>
            ) : (
              posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/content/${post.id}`}
                      className="font-medium text-[var(--tw-dark)] hover:text-[var(--tw-blue)] line-clamp-1"
                    >
                      {post.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <TierBadge tier={post.tier} />
                  </td>
                  <td className="px-4 py-3 text-[var(--tw-mid)] hidden lg:table-cell capitalize">
                    {post.category}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--tw-muted)] hidden lg:table-cell tabular-nums">
                    {post.wordCount.toLocaleString("en-AU")}
                  </td>
                  <td className="px-4 py-3 text-right text-[var(--tw-muted)] hidden xl:table-cell tabular-nums">
                    {post.generationLog?.qualityScore != null
                      ? (post.generationLog.qualityScore * 100).toFixed(0) + "%"
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--tw-muted)] whitespace-nowrap text-xs hidden md:table-cell">
                    {new Date(post.createdAt).toLocaleDateString("en-AU")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={post.status} />
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
