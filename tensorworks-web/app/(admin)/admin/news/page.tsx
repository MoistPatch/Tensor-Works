import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Rss, Layers, AlertOctagon, Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "News Monitoring — TensorWorks Admin" };

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  reviewed: "bg-blue-100 text-blue-800",
  used: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-500",
};

export default async function NewsMonitoringPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [activeSources, itemsToday, pendingClusters, bannedItems, recentClusters] =
    await Promise.all([
      prisma.newsSource.count({ where: { active: true } }),
      prisma.newsItem.count({ where: { fetchedAt: { gte: today } } }),
      prisma.triangulationGroup.count({ where: { status: "pending" } }),
      prisma.newsItem.count({ where: { banned: true } }),
      prisma.triangulationGroup.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          topic: true,
          itemCount: true,
          avgRelevance: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

  const stats = [
    {
      label: "Active sources",
      value: activeSources,
      icon: Rss,
      href: "/admin/news/sources",
      colour: "text-[var(--tw-blue)]",
    },
    {
      label: "Items fetched today",
      value: itemsToday,
      icon: Clock,
      href: "/admin/news/items",
      colour: "text-[var(--tw-green)]",
    },
    {
      label: "Pending clusters",
      value: pendingClusters,
      icon: Layers,
      href: "/admin/news/clusters?status=pending",
      colour: "text-amber-600",
    },
    {
      label: "Banned items",
      value: bannedItems,
      icon: AlertOctagon,
      href: "/admin/news/banned",
      colour: "text-red-600",
    },
  ];

  const quickLinks = [
    { href: "/admin/news/sources", label: "Sources" },
    { href: "/admin/news/items", label: "Items" },
    { href: "/admin/news/clusters", label: "Clusters" },
    { href: "/admin/news/banned", label: "Banned Claims" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">News Monitoring</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">
          Overview of news sources, items, and triangulation clusters
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-[var(--tw-muted)]">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.colour}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${stat.colour}`}>{stat.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--tw-border)] bg-white text-sm font-medium text-[var(--tw-dark)] hover:bg-[var(--tw-bg)] transition-colors"
          >
            {link.label}
            <ArrowRight className="h-3.5 w-3.5 text-[var(--tw-muted)]" />
          </Link>
        ))}
      </div>

      {/* Recent clusters table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent clusters</CardTitle>
          <Link
            href="/admin/news/clusters"
            className="text-sm text-[var(--tw-blue)] hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentClusters.length === 0 ? (
            <p className="text-sm text-[var(--tw-muted)] py-8 text-center">
              No clusters yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
                    <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                      Topic
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                      Items
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">
                      Avg relevance
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentClusters.map(
                    (cluster: {
                      id: string;
                      topic: string;
                      itemCount: number;
                      avgRelevance: number | null;
                      status: string;
                      createdAt: Date;
                    }) => (
                      <tr
                        key={cluster.id}
                        className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/news/clusters?expand=${cluster.id}`}
                            className="font-medium text-[var(--tw-dark)] hover:text-[var(--tw-blue)] line-clamp-1"
                          >
                            {cluster.topic}
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
                        <td className="px-4 py-3 text-xs text-[var(--tw-muted)] hidden lg:table-cell whitespace-nowrap">
                          {new Date(cluster.createdAt).toLocaleDateString("en-AU")}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
