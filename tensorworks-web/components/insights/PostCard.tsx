import Link from "next/link";

interface PostCardProps {
  slug: string;
  tier: string;
  category: string;
  title: string;
  summary: string;
  authorLabel: string;
  readingTimeMin: number;
  publishedAt: Date | null;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    "deep-analysis": "bg-[var(--tw-blue)] text-white",
    "weekly-digest": "bg-[var(--tw-green)] text-white",
    "daily-scan": "bg-gray-200 text-gray-700",
  };
  const labels: Record<string, string> = {
    "deep-analysis": "Deep Analysis",
    "weekly-digest": "Weekly Digest",
    "daily-scan": "Daily Scan",
  };
  const cls = styles[tier] ?? "bg-gray-200 text-gray-700";
  const label = labels[tier] ?? tier;
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded ${cls}`}>
      {label}
    </span>
  );
}

export default function PostCard({
  slug,
  tier,
  category,
  title,
  summary,
  authorLabel,
  readingTimeMin,
  publishedAt,
}: PostCardProps) {
  const truncatedSummary =
    summary.length > 160 ? summary.slice(0, 157) + "…" : summary;

  return (
    <Link
      href={`/insights/${slug}`}
      className="group flex flex-col bg-white border border-[var(--tw-border,#e5e7eb)] rounded-lg overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="flex flex-col flex-1 p-6 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <TierBadge tier={tier} />
          <span className="text-xs text-[var(--tw-muted)] uppercase tracking-wide">
            {category}
          </span>
        </div>

        <h2 className="text-base font-semibold text-[var(--tw-dark)] leading-snug group-hover:text-[var(--tw-blue)] transition-colors">
          {title}
        </h2>

        <p className="text-sm text-[var(--tw-mid)] leading-relaxed flex-1">
          {truncatedSummary}
        </p>

        <div className="flex items-center gap-3 text-xs text-[var(--tw-muted)] pt-2 border-t border-[var(--tw-border,#e5e7eb)]">
          <span>{authorLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{readingTimeMin} min read</span>
          {publishedAt && (
            <>
              <span aria-hidden="true">·</span>
              <span>{formatDate(publishedAt)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
