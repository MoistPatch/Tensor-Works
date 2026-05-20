import Link from "next/link";
import { prisma } from "@/lib/prisma";

interface RelatedPostsProps {
  currentSlug: string;
  tags: string[];
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

export default async function RelatedPosts({ currentSlug, tags }: RelatedPostsProps) {
  if (!tags || tags.length === 0) return null;

  const posts = await prisma.blogPost.findMany({
    where: {
      status: "published",
      tags: { hasSome: tags },
      slug: { not: currentSlug },
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: {
      slug: true,
      title: true,
      tier: true,
      publishedAt: true,
    },
  });

  if (posts.length === 0) return null;

  return (
    <div>
      <h2 className="text-base font-semibold text-[var(--tw-dark)] mb-4">
        Related articles
      </h2>
      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/insights/${post.slug}`}
              className="group flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2">
                <TierBadge tier={post.tier} />
              </div>
              <span className="text-sm font-medium text-[var(--tw-dark)] group-hover:text-[var(--tw-blue)] transition-colors leading-snug">
                {post.title}
              </span>
              {post.publishedAt && (
                <span className="text-xs text-[var(--tw-muted)]">
                  {formatDate(post.publishedAt)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
