import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { solutions } from "@/content/solutions";
import { hardwareCategories } from "@/content/hardware";
import { pageSEO } from "@/content/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, CheckCircle2, Shield, Cpu, AlertTriangle } from "lucide-react";

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

  const solutionIndex = solutions.findIndex((s) => s.slug === slug);
  const prevSolution = solutionIndex > 0 ? solutions[solutionIndex - 1] : null;
  const nextSolution = solutionIndex < solutions.length - 1 ? solutions[solutionIndex + 1] : null;

  const recommendedConfigs = solution.recommendedHardware
    .map((hwSlug) => {
      for (const cat of hardwareCategories) {
        const config = cat.configurations.find((c) => c.slug === hwSlug);
        if (config) return { ...config, categorySlug: cat.slug, categoryTitle: cat.title };
      }
      return null;
    })
    .filter(Boolean) as Array<{
      slug: string;
      title: string;
      gpu: string;
      leadTime: string;
      categorySlug: string;
      categoryTitle: string;
    }>;

  return (
    <>
      {/* Hero */}
      <section className="bg-[var(--tw-dark)] text-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/solutions"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> All solutions
          </Link>
          <div className="max-w-3xl">
            {solution.agsvaCleared && (
              <div className="inline-flex items-center gap-2 bg-[var(--tw-blue)]/20 border border-[var(--tw-blue)]/30 text-blue-200 rounded-full px-3 py-1.5 text-xs font-medium mb-5">
                <Shield className="h-3.5 w-3.5" />
                AGSVA cleared personnel available for classified engagements
              </div>
            )}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {solution.title}
            </h1>
            <p className="text-gray-300 text-lg md:text-xl leading-relaxed mb-2">
              {solution.subtitle}
            </p>
            <p className="text-[var(--tw-blue-light)] font-medium">
              {solution.tagline}
            </p>
          </div>
        </div>
      </section>

      {/* Overview */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-16">

              {/* Overview */}
              <div>
                <h2 className="text-2xl font-bold text-[var(--tw-dark)] mb-5">Overview</h2>
                <p className="text-[var(--tw-mid)] leading-relaxed text-base">
                  {solution.overview}
                </p>
              </div>

              {/* Challenges */}
              <div>
                <h2 className="text-2xl font-bold text-[var(--tw-dark)] mb-6">
                  Challenges this deployment type faces
                </h2>
                <div className="space-y-6">
                  {solution.challenges.map((challenge) => (
                    <div key={challenge.heading} className="flex gap-4">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--tw-dark)] mb-2">
                          {challenge.heading}
                        </h3>
                        <p className="text-sm text-[var(--tw-mid)] leading-relaxed">
                          {challenge.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* How we address them */}
              <div>
                <h2 className="text-2xl font-bold text-[var(--tw-dark)] mb-6">
                  How we address them
                </h2>
                <div className="space-y-6">
                  {solution.approach.map((item, i) => (
                    <div key={item.heading} className="flex gap-4">
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-[var(--tw-blue)]/10 border border-[var(--tw-blue)]/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-[var(--tw-blue)]">{i + 1}</span>
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold text-[var(--tw-dark)] mb-2">
                          {item.heading}
                        </h3>
                        <p className="text-sm text-[var(--tw-mid)] leading-relaxed">
                          {item.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Capability */}
              <div className="bg-[var(--tw-bg)] rounded-xl p-8">
                <h2 className="text-xl font-bold text-[var(--tw-dark)] mb-4">
                  Our capability
                </h2>
                <p className="text-sm text-[var(--tw-mid)] leading-relaxed mb-6">
                  {solution.capabilityDetail}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {solution.capabilities.map((cap) => (
                    <li key={cap} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-[var(--tw-green)] flex-shrink-0 mt-0.5" />
                      <span className="text-[var(--tw-dark)]">{cap}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Use cases */}
              <div>
                <h2 className="text-xl font-bold text-[var(--tw-dark)] mb-4">
                  Workloads and use cases
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {solution.useCases.map((uc) => (
                    <div
                      key={uc}
                      className="flex items-center gap-2 text-sm text-[var(--tw-dark)] border border-[var(--tw-border)] rounded-lg px-4 py-2.5 bg-white"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tw-green)] flex-shrink-0" />
                      {uc}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* AGSVA cleared badge — sidebar */}
              {solution.agsvaCleared && (
                <div className="border border-[var(--tw-blue)]/30 bg-[var(--tw-blue)]/5 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-5 w-5 text-[var(--tw-blue)]" />
                    <h3 className="font-semibold text-[var(--tw-dark)] text-sm">
                      AGSVA security clearance
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--tw-mid)] leading-relaxed">
                    TensorWorks holds AGSVA security clearances at the levels required
                    for the engagements we take on. Cleared personnel are available for
                    system configuration, delivery, installation, and ongoing support
                    in classified facilities. Personnel security is managed as part of
                    the project plan.
                  </p>
                </div>
              )}

              {/* Sovereign requirements badge */}
              {solution.sovereignRequirements && !solution.agsvaCleared && (
                <div className="border border-[var(--tw-border)] bg-[var(--tw-bg)] rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="h-4 w-4 text-[var(--tw-blue)]" />
                    <h3 className="font-semibold text-[var(--tw-dark)] text-sm">
                      Sovereign supply chain
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--tw-mid)] leading-relaxed">
                    Full provenance documentation, ITAR compliance assessments,
                    and Australian Industry Participation plans are standard
                    deliverables for this solution type.
                  </p>
                </div>
              )}

              {/* Recommended hardware */}
              {recommendedConfigs.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-[var(--tw-dark)] mb-3">
                    Recommended hardware
                  </h2>
                  <div className="space-y-3">
                    {recommendedConfigs.map((config) => (
                      <Card key={config.slug} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2 pt-4 px-4">
                          <div className="flex items-start gap-2">
                            <Cpu className="h-4 w-4 text-[var(--tw-blue)] flex-shrink-0 mt-0.5" />
                            <div>
                              <CardTitle className="text-sm">{config.title}</CardTitle>
                              <p className="text-xs text-[var(--tw-muted)] mt-0.5">
                                Lead time: {config.leadTime}
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="px-4 pb-4">
                          <p className="text-xs text-[var(--tw-mid)] mb-2">{config.gpu}</p>
                          <Link
                            href={`/hardware/${config.categorySlug}`}
                            className="text-xs text-[var(--tw-blue)] hover:underline inline-flex items-center gap-1"
                          >
                            View full specification <ArrowRight className="h-3 w-3" />
                          </Link>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* RFQ CTA */}
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

      {/* Adjacent solutions nav */}
      {(prevSolution || nextSolution) && (
        <section className="py-10 border-t border-[var(--tw-border)] bg-[var(--tw-bg)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              {prevSolution ? (
                <Link
                  href={`/solutions/${prevSolution.slug}`}
                  className="group flex items-center gap-3 text-sm text-[var(--tw-mid)] hover:text-[var(--tw-dark)] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                  <div>
                    <p className="text-xs text-[var(--tw-muted)] mb-0.5">Previous</p>
                    <p className="font-medium">{prevSolution.title}</p>
                  </div>
                </Link>
              ) : (
                <div />
              )}
              {nextSolution && (
                <Link
                  href={`/solutions/${nextSolution.slug}`}
                  className="group flex items-center gap-3 text-sm text-[var(--tw-mid)] hover:text-[var(--tw-dark)] transition-colors sm:text-right"
                >
                  <div>
                    <p className="text-xs text-[var(--tw-muted)] mb-0.5">Next</p>
                    <p className="font-medium">{nextSolution.title}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
