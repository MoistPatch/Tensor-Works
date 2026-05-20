import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "News Items — TensorWorks Admin" };

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ page?: string; sourceId?: string; banned?: string }>;
}

export default async function NewsItemsPage({ searchParams }: Props) {
  const { page, sourceId, banned } = await searchParams;

  const currentPage = Math.max(1, parseInt(page ?? "1", 10));
  const skip = (currentPage - 1) * PAGE_SIZE;

  const where: Record<string, unknown> = {};
  if (sourceId) where.sourceId = sourceId;
  if (banned === "true") where.banned = true;
  if (banned === "false") where.banned = false;

  const [items, total, sources] = await Promise.all([
    prisma.newsItem.findMany({
      where,
      orderBy: { fetchedAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        url: true,
        publishedAt: true,
        relevanceScore: true,
        sentimentScore: true,
        banned: true,
        clusterId: true,
        source: { select: { id: true, name: true } },
      },
    }),
    prisma.newsItem.count({ where }),
    prisma.newsSource.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildHref(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { page, sourceId, banned, ...overrides };
    if (merged.page && merged.page !== "1") params.set("page", merged.page);
    if (merged.sourceId) params.set("sourceId", merged.sourceId);
    if (merged.banned) params.set("banned", merged.banned);
    const qs = params.toString();
    return `/admin/news/items${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">News Items</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">
          {total.toLocaleString("en-AU")} items total
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <label htmlFor="source-filter" className="text-[var(--tw-muted)]">
            Source:
          </label>
          {/* Using plain anchor links for server-side filtering */}
          <div className="flex gap-1 flex-wrap">
            <Link
              href={buildHref({ sourceId: undefined, page: "1" })}
              className={`px-3 py-1.5 rounded-md border transition-colors ${
                !sourceId
                  ? "border-[var(--tw-blue)] bg-[var(--tw-blue)] text-white"
                  : "border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)]"
              }`}
            >
              All
            </Link>
            {sources.map((s) => (
              <Link
                key={s.id}
                href={buildHref({ sourceId: s.id, page: "1" })}
                className={`px-3 py-1.5 rounded-md border transition-colors ${
                  sourceId === s.id
                    ? "border-[var(--tw-blue)] bg-[var(--tw-blue)] text-white"
                    : "border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)]"
                }`}
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[var(--tw-muted)]">Banned:</span>
          <Link
            href={buildHref({ banned: undefined, page: "1" })}
            className={`px-3 py-1.5 rounded-md border transition-colors ${
              !banned
                ? "border-[var(--tw-blue)] bg-[var(--tw-blue)] text-white"
                : "border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)]"
            }`}
          >
            All
          </Link>
          <Link
            href={buildHref({ banned: "true", page: "1" })}
            className={`px-3 py-1.5 rounded-md border transition-colors ${
              banned === "true"
                ? "border-[var(--tw-blue)] bg-[var(--tw-blue)] text-white"
                : "border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)]"
            }`}
          >
            Banned
          </Link>
          <Link
            href={buildHref({ banned: "false", page: "1" })}
            className={`px-3 py-1.5 rounded-md border transition-colors ${
              banned === "false"
                ? "border-[var(--tw-blue)] bg-[var(--tw-blue)] text-white"
                : "border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)]"
            }`}
          >
            Not banned
          </Link>
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Title</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">
                    Source
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">
                    Published
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                    Relevance
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden xl:table-cell">
                    Sentiment
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">
                    Cluster
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-[var(--tw-muted)]"
                    >
                      No items found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)] transition-colors"
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[var(--tw-dark)] hover:text-[var(--tw-blue)] line-clamp-2 block"
                        >
                          {item.title}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-[var(--tw-mid)] whitespace-nowrap hidden md:table-cell">
                        {item.source.name}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--tw-muted)] whitespace-nowrap hidden lg:table-cell">
                        {item.publishedAt
                          ? new Date(item.publishedAt).toLocaleDateString("en-AU")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {item.relevanceScore != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[var(--tw-blue)] rounded-full"
                                style={{ width: `${(item.relevanceScore * 100).toFixed(0)}%` }}
                              />
                            </div>
                            <span className="text-xs text-[var(--tw-muted)] tabular-nums">
                              {(item.relevanceScore * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--tw-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--tw-muted)] tabular-nums hidden xl:table-cell">
                        {item.sentimentScore != null
                          ? item.sentimentScore.toFixed(2)
                          : "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {item.clusterId ? (
                          <Link
                            href={`/admin/news/clusters?expand=${item.clusterId}`}
                            className="text-xs text-[var(--tw-blue)] hover:underline"
                          >
                            View cluster
                          </Link>
                        ) : (
                          <span className="text-xs text-[var(--tw-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.banned ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Banned
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <BanToggleForm id={item.id} banned={item.banned} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--tw-muted)]">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 && (
              <Link
                href={buildHref({ page: String(currentPage - 1) })}
                className="px-4 py-2 rounded-md border border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)] transition-colors"
              >
                ← Previous
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={buildHref({ page: String(currentPage + 1) })}
                className="px-4 py-2 rounded-md border border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)] transition-colors"
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

function BanToggleForm({ id, banned }: { id: string; banned: boolean }) {
  return (
    <form action={`/api/admin/news/items/${id}`} method="POST">
      <input type="hidden" name="_method" value="PATCH" />
      <input type="hidden" name="banned" value={banned ? "false" : "true"} />
      <button
        type="submit"
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
          banned
            ? "bg-green-100 text-green-700 hover:bg-green-200"
            : "bg-red-100 text-red-700 hover:bg-red-200"
        }`}
      >
        {banned ? "Unban" : "Ban"}
      </button>
    </form>
  );
}
