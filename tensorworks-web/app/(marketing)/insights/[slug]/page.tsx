import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { siteSEO } from "@/content/seo";
import PostBody from "@/components/insights/PostBody";
import RelatedPosts from "@/components/insights/RelatedPosts";
import { SignupForm } from "@/components/newsletter/SignupForm";

interface Props {
  params: Promise<{ slug: string }>;
}

function formatDate(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
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
    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded ${cls}`}>
      {label}
    </span>
  );
}

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  // Build-time DB access is optional — pages render on-demand if the database
  // isn't reachable during the build (e.g. CI without DATABASE_URL).
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: "published" },
      select: { slug: true },
    });
    return posts.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost
    .findUnique({
      where: { slug },
      select: { title: true, summary: true, publishedAt: true, coverImageUrl: true },
    })
    .catch(() => null);

  if (!post) {
    return { title: "Article not found — TensorWorks" };
  }

  const description = post.summary.slice(0, 155);
  const siteUrl = siteSEO.siteUrl;

  return {
    title: `${post.title} — TensorWorks`,
    description,
    openGraph: {
      title: `${post.title} — TensorWorks`,
      description,
      url: `${siteUrl}/insights/${slug}`,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      ...(post.coverImageUrl ? { images: [{ url: post.coverImageUrl }] } : {}),
    },
  };
}

export default async function InsightPostPage({ params }: Props) {
  const { slug } = await params;

  const post = await prisma.blogPost
    .findUnique({
      where: { slug },
    })
    .catch(() => null);

  if (!post || post.status !== "published") {
    notFound();
  }

  const siteUrl = siteSEO.siteUrl;

  const citations = Array.isArray(post.citations)
    ? (post.citations as Array<{ title: string; url: string; accessed: string }>)
    : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.summary.slice(0, 155),
    author: {
      "@type": "Organization",
      name: post.authorLabel,
    },
    publisher: {
      "@type": "Organization",
      name: "TensorWorks",
      url: siteUrl,
    },
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    url: `${siteUrl}/insights/${slug}`,
    ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/insights"
            className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-8 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            All articles
          </Link>

          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-4 leading-tight">
            {post.title}
          </h1>

          {post.subtitle && (
            <p className="text-gray-300 text-xl mb-8 leading-relaxed">
              {post.subtitle}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
            <TierBadge tier={post.tier} />
            <span className="text-gray-500 uppercase tracking-wide text-xs">
              {post.category}
            </span>
            <span aria-hidden="true" className="text-gray-600">·</span>
            <span>{post.authorLabel}</span>
            {post.publishedAt && (
              <>
                <span aria-hidden="true" className="text-gray-600">·</span>
                <span>{formatDate(post.publishedAt)}</span>
              </>
            )}
            <span aria-hidden="true" className="text-gray-600">·</span>
            <span>{post.readingTimeMin} min read</span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-12 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-3 lg:gap-12">
            {/* Main body — 2/3 */}
            <main className="lg:col-span-2 min-w-0">
              <PostBody body={post.body} />

              <div className="mt-12 p-6 rounded-lg bg-[var(--tw-bg,#F5F8FB)] border border-[var(--tw-border,#e5e7eb)]">
                <h3 className="text-lg font-semibold text-[var(--tw-dark)] mb-2">Found this useful?</h3>
                <p className="text-sm text-[var(--tw-mid)] mb-4">
                  Get fortnightly insights on AI hardware, GPU infrastructure, and procurement in Australia.
                </p>
                <SignupForm variant="compact" />
              </div>
            </main>

            {/* Sidebar — 1/3 */}
            <aside className="mt-12 lg:mt-0 space-y-8">
              {/* Citations */}
              {citations.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-[var(--tw-dark)] mb-4">
                    References
                  </h2>
                  <ol className="space-y-3 list-decimal list-inside">
                    {citations.map((cite, i) => (
                      <li key={i} className="text-sm text-[var(--tw-mid)] leading-relaxed">
                        <a
                          href={cite.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--tw-blue)] hover:underline"
                        >
                          {cite.title}
                        </a>
                        {cite.accessed && (
                          <span className="text-[var(--tw-muted)] ml-1">
                            (accessed {cite.accessed})
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div>
                  <h2 className="text-base font-semibold text-[var(--tw-dark)] mb-4">
                    Tags
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block text-xs px-2.5 py-1 rounded-full bg-[var(--tw-light,#F5F8FB)] text-[var(--tw-mid)] border border-[var(--tw-border,#e5e7eb)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Related posts */}
              <RelatedPosts currentSlug={slug} tags={post.tags ?? []} />

              {/* Back link */}
              <div className="pt-4 border-t border-[var(--tw-border,#e5e7eb)]">
                <Link
                  href="/insights"
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--tw-blue)] hover:underline"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Insights
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
