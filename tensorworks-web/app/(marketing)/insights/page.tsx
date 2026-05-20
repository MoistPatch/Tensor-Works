import type { Metadata } from "next";
import Link from "next/link";
import { pageSEO } from "@/content/seo";
import { prisma } from "@/lib/prisma";
import PostCard from "@/components/insights/PostCard";

export const metadata: Metadata = {
  title: pageSEO.insights.title,
  description: pageSEO.insights.description,
};

const CATEGORIES = [
  { value: "", label: "All" },
  { value: "GPU Architecture", label: "GPU Architecture" },
  { value: "AI Infrastructure", label: "AI Infrastructure" },
  { value: "Procurement", label: "Procurement" },
  { value: "Industry Analysis", label: "Industry Analysis" },
  { value: "Research Highlights", label: "Research Highlights" },
];

const TIERS = [
  { value: "", label: "All" },
  { value: "daily-scan", label: "Daily Scan" },
  { value: "weekly-digest", label: "Weekly Digest" },
  { value: "deep-analysis", label: "Deep Analysis" },
];

const PAGE_SIZE = 12;

interface SearchParams {
  category?: string | string[];
  tier?: string | string[];
  page?: string | string[];
}

interface Props {
  searchParams: Promise<SearchParams>;
}

function getString(val: string | string[] | undefined): string {
  if (!val) return "";
  return Array.isArray(val) ? val[0] : val;
}

function buildHref(
  currentCategory: string,
  currentTier: string,
  currentPage: number,
  overrides: { category?: string; tier?: string; page?: number }
): string {
  const category = overrides.category !== undefined ? overrides.category : currentCategory;
  const tier = overrides.tier !== undefined ? overrides.tier : currentTier;
  const page = overrides.page !== undefined ? overrides.page : currentPage;
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (tier) params.set("tier", tier);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `?${qs}` : "/insights";
}

export default async function InsightsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = getString(sp.category);
  const tier = getString(sp.tier);
  const pageNum = Math.max(1, parseInt(getString(sp.page) || "1", 10));

  const where: Record<string, unknown> = { status: "published" };
  if (category) where.category = category;
  if (tier) where.tier = tier;

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      take: PAGE_SIZE,
      skip: (pageNum - 1) * PAGE_SIZE,
      select: {
        slug: true,
        tier: true,
        category: true,
        title: true,
        summary: true,
        authorLabel: true,
        readingTimeMin: true,
        publishedAt: true,
      },
    }),
    prisma.blogPost.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Insights</h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            Technical articles and guidance on AI compute infrastructure from the
            TensorWorks engineering team.
          </p>
        </div>
      </section>

      <section className="py-10 bg-[var(--tw-light,#F5F8FB)] border-b border-[var(--tw-border,#e5e7eb)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-4">
          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tw-muted)] mr-2">
              Category
            </span>
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.value;
              return (
                <Link
                  key={cat.value}
                  href={buildHref(category, tier, 1, { category: cat.value })}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    isActive
                      ? "bg-[var(--tw-dark)] text-white"
                      : "bg-white text-[var(--tw-mid)] hover:bg-gray-100 border border-[var(--tw-border,#e5e7eb)]"
                  }`}
                >
                  {cat.label}
                </Link>
              );
            })}
          </div>

          {/* Tier pills */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tw-muted)] mr-2">
              Type
            </span>
            {TIERS.map((t) => {
              const isActive = tier === t.value;
              const accentClass =
                t.value === "deep-analysis"
                  ? "bg-[var(--tw-blue)] text-white"
                  : t.value === "weekly-digest"
                  ? "bg-[var(--tw-green)] text-white"
                  : t.value === "daily-scan"
                  ? "bg-gray-500 text-white"
                  : "bg-[var(--tw-dark)] text-white";
              return (
                <Link
                  key={t.value}
                  href={buildHref(category, tier, 1, { tier: t.value })}
                  className={`px-3 py-1.5 text-sm rounded-full font-medium transition-colors ${
                    isActive
                      ? accentClass
                      : "bg-white text-[var(--tw-mid)] hover:bg-gray-100 border border-[var(--tw-border,#e5e7eb)]"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {posts.length === 0 ? (
            <div className="max-w-lg mx-auto text-center py-20">
              <p className="text-[var(--tw-muted)] text-sm uppercase tracking-widest mb-4">
                No articles found
              </p>
              <h2 className="text-2xl font-bold text-[var(--tw-dark)] mb-4">
                No articles match these filters
              </h2>
              <p className="text-[var(--tw-mid)] leading-relaxed mb-8">
                Try adjusting the category or type filters, or view all published articles.
              </p>
              <Link
                href="/insights"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--tw-blue)] text-white text-sm font-medium rounded-md hover:opacity-90 transition-opacity"
              >
                View all articles
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <PostCard
                    key={post.slug}
                    slug={post.slug}
                    tier={post.tier}
                    category={post.category}
                    title={post.title}
                    summary={post.summary}
                    authorLabel={post.authorLabel}
                    readingTimeMin={post.readingTimeMin}
                    publishedAt={post.publishedAt}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <nav
                  className="flex items-center justify-center gap-4 mt-12 pt-8 border-t border-[var(--tw-border,#e5e7eb)]"
                  aria-label="Pagination"
                >
                  {pageNum > 1 ? (
                    <Link
                      href={buildHref(category, tier, pageNum, { page: pageNum - 1 })}
                      className="px-4 py-2 text-sm font-medium text-[var(--tw-blue)] border border-[var(--tw-blue)] rounded-md hover:bg-blue-50 transition-colors"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span className="px-4 py-2 text-sm font-medium text-gray-300 border border-gray-200 rounded-md cursor-not-allowed">
                      Previous
                    </span>
                  )}

                  <span className="text-sm text-[var(--tw-muted)]">
                    Page {pageNum} of {totalPages}
                  </span>

                  {pageNum < totalPages ? (
                    <Link
                      href={buildHref(category, tier, pageNum, { page: pageNum + 1 })}
                      className="px-4 py-2 text-sm font-medium text-[var(--tw-blue)] border border-[var(--tw-blue)] rounded-md hover:bg-blue-50 transition-colors"
                    >
                      Next
                    </Link>
                  ) : (
                    <span className="px-4 py-2 text-sm font-medium text-gray-300 border border-gray-200 rounded-md cursor-not-allowed">
                      Next
                    </span>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
