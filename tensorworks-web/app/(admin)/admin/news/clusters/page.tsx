import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Triangulation Clusters — TensorWorks Admin" };

const VALID_STATUSES = ["pending", "reviewed", "used", "dismissed"] as const;
type ClusterStatus = (typeof VALID_STATUSES)[number];

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  reviewed: "bg-blue-100 text-blue-800",
  used: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-500",
};

interface Props {
  searchParams: Promise<{ status?: string; expand?: string }>;
}

export default async function ClustersPage({ searchParams }: Props) {
  const { status, expand } = await searchParams;

  const activeStatus = VALID_STATUSES.includes(status as ClusterStatus) ? status : undefined;

  const where = activeStatus ? { status: activeStatus } : undefined;

  const clusters = await prisma.triangulationGroup.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      topic: true,
      itemCount: true,
      avgRelevance: true,
      status: true,
      createdAt: true,
    },
  });

  // If a cluster is expanded, fetch its items
  let expandedItems: Array<{
    id: string;
    title: string;
    url: string;
    publishedAt: Date | null;
    relevanceScore: number | null;
    source: { name: string };
  }> = [];

  if (expand) {
    expandedItems = await prisma.newsItem.findMany({
      where: { clusterId: expand },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        url: true,
        publishedAt: true,
        relevanceScore: true,
        source: { select: { name: true } },
      },
    });
  }

  function buildStatusHref(s: string | undefined) {
    const params = new URLSearchParams();
    if (s) params.set("status", s);
    if (expand) params.set("expand", expand);
    const qs = params.toString();
    return `/admin/news/clusters${qs ? `?${qs}` : ""}`;
  }

  function buildExpandHref(clusterId: string) {
    const params = new URLSearchParams();
    if (activeStatus) params.set("status", activeStatus);
    // Toggle expand: if already expanded, collapse
    if (expand !== clusterId) params.set("expand", clusterId);
    const qs = params.toString();
    return `/admin/news/clusters${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Triangulation Clusters</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">{clusters.length} clusters shown</p>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--tw-muted)]">Filter:</span>
        {[undefined, ...VALID_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={buildStatusHref(s)}
            className={`px-3 py-1.5 rounded-md border transition-colors capitalize ${
              activeStatus === s
                ? "border-[var(--tw-blue)] bg-[var(--tw-blue)] text-white"
                : "border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)]"
            }`}
          >
            {s ?? "All"}
          </Link>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Topic</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Items</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">
                    Avg relevance
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">
                    Created
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clusters.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-[var(--tw-muted)]"
                    >
                      No clusters found.
                    </td>
                  </tr>
                ) : (
                  clusters.map((cluster) => (
                    <>
                      <tr
                        key={cluster.id}
                        className="border-b border-[var(--tw-border)] hover:bg-[var(--tw-bg)] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={buildExpandHref(cluster.id)}
                            className="font-medium text-[var(--tw-dark)] hover:text-[var(--tw-blue)] line-clamp-2 block"
                          >
                            {cluster.topic}
                            {expand === cluster.id && (
                              <span className="ml-2 text-xs text-[var(--tw-muted)]">▲ collapse</span>
                            )}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-[var(--tw-mid)]">{cluster.itemCount}</td>
                        <td className="px-4 py-3 text-[var(--tw-mid)] hidden md:table-cell">
                          {cluster.avgRelevance != null
                            ? `${(cluster.avgRelevance * 100).toFixed(0)}%`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              STATUS_BADGE[cluster.status] ?? "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {cluster.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--tw-muted)] whitespace-nowrap hidden lg:table-cell">
                          {new Date(cluster.createdAt).toLocaleDateString("en-AU")}
                        </td>
                        <td className="px-4 py-3">
                          <ClusterActions id={cluster.id} currentStatus={cluster.status} />
                        </td>
                      </tr>
                      {expand === cluster.id && (
                        <tr key={`${cluster.id}-expanded`} className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
                          <td colSpan={6} className="px-6 py-4">
                            {expandedItems.length === 0 ? (
                              <p className="text-sm text-[var(--tw-muted)]">No items in this cluster.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-[var(--tw-border)]">
                                    <th className="text-left pb-2 font-medium text-[var(--tw-muted)]">
                                      Title
                                    </th>
                                    <th className="text-left pb-2 font-medium text-[var(--tw-muted)] hidden sm:table-cell">
                                      Source
                                    </th>
                                    <th className="text-left pb-2 font-medium text-[var(--tw-muted)] hidden md:table-cell">
                                      Published
                                    </th>
                                    <th className="text-left pb-2 font-medium text-[var(--tw-muted)]">
                                      Relevance
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {expandedItems.map((item) => (
                                    <tr
                                      key={item.id}
                                      className="border-b border-[var(--tw-border)] last:border-0"
                                    >
                                      <td className="py-2 pr-4">
                                        <a
                                          href={item.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[var(--tw-blue)] hover:underline line-clamp-1"
                                        >
                                          {item.title}
                                        </a>
                                      </td>
                                      <td className="py-2 pr-4 text-[var(--tw-muted)] hidden sm:table-cell">
                                        {item.source.name}
                                      </td>
                                      <td className="py-2 pr-4 text-[var(--tw-muted)] hidden md:table-cell whitespace-nowrap">
                                        {item.publishedAt
                                          ? new Date(item.publishedAt).toLocaleDateString("en-AU")
                                          : "—"}
                                      </td>
                                      <td className="py-2 text-[var(--tw-muted)]">
                                        {item.relevanceScore != null
                                          ? `${(item.relevanceScore * 100).toFixed(0)}%`
                                          : "—"}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClusterActions({ id, currentStatus }: { id: string; currentStatus: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {currentStatus !== "reviewed" && (
        <form action={`/api/admin/news/clusters/${id}`} method="POST">
          <input type="hidden" name="_method" value="PATCH" />
          <input type="hidden" name="status" value="reviewed" />
          <button
            type="submit"
            className="px-2.5 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
          >
            Mark reviewed
          </button>
        </form>
      )}
      {currentStatus !== "used" && (
        <form action={`/api/admin/news/clusters/${id}`} method="POST">
          <input type="hidden" name="_method" value="PATCH" />
          <input type="hidden" name="status" value="used" />
          <button
            type="submit"
            className="px-2.5 py-1 rounded text-xs font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
          >
            Use in post
          </button>
        </form>
      )}
      {currentStatus !== "dismissed" && (
        <form action={`/api/admin/news/clusters/${id}`} method="POST">
          <input type="hidden" name="_method" value="PATCH" />
          <input type="hidden" name="status" value="dismissed" />
          <button
            type="submit"
            className="px-2.5 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            Dismiss
          </button>
        </form>
      )}
    </div>
  );
}
