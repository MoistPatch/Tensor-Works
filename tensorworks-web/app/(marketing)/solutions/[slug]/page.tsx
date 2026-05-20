import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { solutions } from "@/content/solutions";
import { hardwareCategories } from "@/content/hardware";
import { pageSEO } from "@/content/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, ArrowLeft, Cpu } from "lucide-react";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return solutions.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const key = `solutions/${slug}` as keyof typeof pageSEO;
  const seo = pageSEO[key];
  if (!seo) return {};
  return { title: seo.title, description: seo.description };
}

export default async function SolutionPage({ params }: Props) {
  const { slug } = await params;
  const solution = solutions.find((s) => s.slug === slug);
  if (!solution) notFound();

  const recommendedConfigs = solution.recommendedHardware
    .map((hwSlug) => {
      for (const cat of hardwareCategories) {
        const config = cat.configurations.find((c) => c.slug === hwSlug);
        if (config) return { ...config, categorySlug: cat.slug, categoryTitle: cat.title };
      }
      return null;
    })
    .filter(Boolean) as Array<{ slug: string; title: string; categorySlug: string; categoryTitle: string; leadTime: string }>;

  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/solutions"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> All solutions
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            {solution.title}
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl">{solution.subtitle}</p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-10">
              <div>
                <h2 className="text-xl font-semibold text-[var(--tw-dark)] mb-4">Overview</h2>
                <p className="text-[var(--tw-mid)] leading-relaxed">{solution.description}</p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-[var(--tw-dark)] mb-4">Capabilities</h2>
                <ul className="space-y-3">
                  {solution.capabilities.map((cap) => (
                    <li key={cap} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-[var(--tw-green)] flex-shrink-0 mt-0.5" />
                      <span className="text-[var(--tw-dark)]">{cap}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-[var(--tw-dark)] mb-4">Use cases</h2>
                <div className="flex flex-wrap gap-2">
                  {solution.useCases.map((uc) => (
                    <Badge key={uc} variant="secondary">{uc}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-[var(--tw-dark)] mb-4">Recommended hardware</h2>
                <div className="space-y-3">
                  {recommendedConfigs.length > 0 ? (
                    recommendedConfigs.map((config) => (
                      <Card key={config.slug} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2 pt-4 px-4">
                          <div className="flex items-start gap-2">
                            <Cpu className="h-4 w-4 text-[var(--tw-blue)] flex-shrink-0 mt-0.5" />
                            <div>
                              <CardTitle className="text-sm">{config.title}</CardTitle>
                              <p className="text-xs text-[var(--tw-muted)] mt-0.5">Lead time: {config.leadTime}</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                          <Link
                            href={`/hardware/${config.categorySlug}`}
                            className="text-xs text-[var(--tw-blue)] hover:underline inline-flex items-center gap-1"
                          >
                            View configuration <ArrowRight className="h-3 w-3" />
                          </Link>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--tw-muted)]">Contact us to discuss hardware for this solution.</p>
                  )}
                </div>
              </div>

              <Card className="bg-[var(--tw-blue)] border-0">
                <CardContent className="p-5">
                  <h3 className="font-semibold text-white mb-2">Ready to proceed?</h3>
                  <p className="text-blue-100 text-sm mb-4">
                    Submit an RFQ and we will respond with a scoped proposal within
                    two business days.
                  </p>
                  <Button asChild variant="accent" size="sm" className="w-full">
                    <Link href="/contact">Request a Quote</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
