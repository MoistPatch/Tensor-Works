import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

export const metadata = { title: "News Sources — TensorWorks Admin" };

const FETCH_TYPE_BADGE: Record<string, string> = {
  rss: "bg-blue-100 text-blue-800",
  api: "bg-green-100 text-green-800",
  scrape: "bg-orange-100 text-orange-800",
};

interface Props {
  searchParams: Promise<{ active?: string }>;
}

export default async function NewsSourcesPage({ searchParams }: Props) {
  const { active } = await searchParams;

  const where =
    active === "true"
      ? { active: true }
      : active === "false"
      ? { active: false }
      : undefined;

  const sources = await prisma.newsSource.findMany({
    where,
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--tw-dark)]">News Sources</h1>
          <p className="text-sm text-[var(--tw-muted)] mt-1">{sources.length} sources</p>
        </div>
        <Link
          href="/admin/news/sources/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--tw-blue)] text-white text-sm font-medium hover:bg-[var(--tw-blue-dark)] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add source
        </Link>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-[var(--tw-muted)]">Filter:</span>
        <Link
          href="/admin/news/sources"
          className={`px-3 py-1.5 rounded-md border transition-colors ${
            !active
              ? "border-[var(--tw-blue)] bg-[var(--tw-blue)] text-white"
              : "border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)]"
          }`}
        >
          All
        </Link>
        <Link
          href="/admin/news/sources?active=true"
          className={`px-3 py-1.5 rounded-md border transition-colors ${
            active === "true"
              ? "border-[var(--tw-blue)] bg-[var(--tw-blue)] text-white"
              : "border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)]"
          }`}
        >
          Active
        </Link>
        <Link
          href="/admin/news/sources?active=false"
          className={`px-3 py-1.5 rounded-md border transition-colors ${
            active === "false"
              ? "border-[var(--tw-blue)] bg-[var(--tw-blue)] text-white"
              : "border-[var(--tw-border)] text-[var(--tw-mid)] hover:bg-[var(--tw-bg)]"
          }`}
        >
          Inactive
        </Link>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">
                    Category
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                    Active
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">
                    Trust score
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden xl:table-cell">
                    Last fetched
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                    Errors
                  </th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-[var(--tw-muted)]"
                    >
                      No sources found.
                    </td>
                  </tr>
                ) : (
                  sources.map(
                    (source: {
                      id: string;
                      name: string;
                      url: string;
                      fetchType: string;
                      category: string;
                      active: boolean;
                      trustScore: number;
                      lastFetchedAt: Date | null;
                      fetchErrors: number;
                    }) => (
                      <tr
                        key={source.id}
                        className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-[var(--tw-dark)] hover:text-[var(--tw-blue)]"
                          >
                            {source.name}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              FETCH_TYPE_BADGE[source.fetchType] ??
                              "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {source.fetchType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--tw-mid)] hidden md:table-cell">
                          {source.category}
                        </td>
                        <td className="px-4 py-3">
                          <SourceActiveToggle id={source.id} active={source.active} />
                        </td>
                        <td className="px-4 py-3 text-[var(--tw-mid)] hidden lg:table-cell">
                          {source.trustScore.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--tw-muted)] hidden xl:table-cell whitespace-nowrap">
                          {source.lastFetchedAt
                            ? new Date(source.lastFetchedAt).toLocaleString("en-AU")
                            : "Never"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              source.fetchErrors > 3
                                ? "text-red-600 font-semibold"
                                : "text-[var(--tw-mid)]"
                            }
                          >
                            {source.fetchErrors}
                          </span>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Client component for the active toggle
function SourceActiveToggle({ id, active }: { id: string; active: boolean }) {
  return (
    <form
      action={`/api/admin/news/sources/${id}`}
      method="POST"
      data-patch="true"
    >
      <input type="hidden" name="_method" value="PATCH" />
      <input type="hidden" name="active" value={active ? "false" : "true"} />
      <button
        type="submit"
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] focus:ring-offset-1 ${
          active ? "bg-[var(--tw-green)]" : "bg-gray-300"
        }`}
        aria-label={active ? "Deactivate source" : "Activate source"}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            active ? "translate-x-4" : "translate-x-1"
          }`}
        />
      </button>
    </form>
  );
}
