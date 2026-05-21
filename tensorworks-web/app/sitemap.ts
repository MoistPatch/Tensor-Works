import type { MetadataRoute } from "next";
import { solutions } from "@/content/solutions";
import { hardwareCategories } from "@/content/hardware";
import { prisma } from "@/lib/prisma";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tensorworks.online";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE}/solutions`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/hardware`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/services`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/insights`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];

  const solutionRoutes: MetadataRoute.Sitemap = solutions.map((s) => ({
    url: `${BASE}/solutions/${s.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const hardwareRoutes: MetadataRoute.Sitemap = hardwareCategories.map((c) => ({
    url: `${BASE}/hardware/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // Blog posts — falls back to empty if DB is unreachable (e.g. CI build)
  const posts = await prisma.blogPost
    .findMany({
      where: { status: "published" },
      select: { slug: true, updatedAt: true, publishedAt: true },
      orderBy: { publishedAt: "desc" },
    })
    .catch(() => []);

  const postRoutes: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE}/insights/${p.slug}`,
    lastModified: p.updatedAt ?? p.publishedAt ?? now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...solutionRoutes, ...hardwareRoutes, ...postRoutes];
}
