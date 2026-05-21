import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hardwareCategories } from "@/content/hardware";
import { pageSEO } from "@/content/seo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Clock, FileText } from "lucide-react";

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return hardwareCategories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const cat = hardwareCategories.find((c) => c.slug === category);
  if (!cat) return {};
  const key = `hardware/${category}` as keyof typeof pageSEO;
  const seo = pageSEO[key];
  return {
    title: seo?.title ?? `${cat.title} — TensorWorks`,
    description: seo?.description ?? cat.description,
  };
}

const specLabels: Record<string, string> = {
  gpu: "GPU",
  cpu: "CPU",
  ram: "RAM",
  storage: "Storage",
  network: "Network",
  powerDraw: "Power draw",
  formFactor: "Form factor",
};

export default async function HardwareCategoryPage({ params }: Props) {
  const { category } = await params;
  const cat = hardwareCategories.find((c) => c.slug === category);
  if (!cat) notFound();

  const otherCategories = hardwareCategories.filter((c) => c.slug !== category);

  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/hardware"
            className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> All hardware
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            {cat.title}
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl">{cat.description}</p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {cat.configurations.map((config) => (
              <div
                key={config.slug}
                id={config.slug}
                className="border border-[var(--tw-border)] rounded-xl overflow-hidden scroll-mt-20"
              >
                <div className="bg-[var(--tw-bg)] px-6 py-5 border-b border-[var(--tw-border)] flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--tw-dark)]">{config.title}</h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {config.formFactor && (
                        <Badge variant="secondary">{config.formFactor}</Badge>
                      )}
                      <div className="flex items-center gap-1 text-xs text-[var(--tw-muted)]">
                        <Clock className="h-3.5 w-3.5" />
                        Lead time: {config.leadTime}
                      </div>
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href="/contact">
                      Request a Quote <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>

                <div className="px-6 py-6 grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-[var(--tw-border)]">
                  <div className="pb-6 md:pb-0 md:pr-8">
                    <h3 className="text-xs font-semibold text-[var(--tw-muted)] uppercase tracking-wide mb-4">
                      Specifications
                    </h3>
                    <dl className="space-y-3">
                      {(["gpu", "cpu", "ram", "storage", "network", "powerDraw", "formFactor"] as const).map(
                        (key) => {
                          const val = config[key];
                          if (!val) return null;
                          return (
                            <div key={key} className="grid grid-cols-5 gap-2 text-sm">
                              <dt className="col-span-2 text-[var(--tw-muted)] font-medium">
                                {specLabels[key]}
                              </dt>
                              <dd className="col-span-3 text-[var(--tw-dark)]">{val}</dd>
                            </div>
                          );
                        }
                      )}
                    </dl>
                  </div>

                  <div className="pt-6 md:pt-0 md:pl-8">
                    <h3 className="text-xs font-semibold text-[var(--tw-muted)] uppercase tracking-wide mb-4">
                      Use cases
                    </h3>
                    <ul className="space-y-2 mb-6">
                      {config.useCases.map((uc) => (
                        <li key={uc} className="flex items-center gap-2 text-sm text-[var(--tw-dark)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--tw-green)] flex-shrink-0" />
                          {uc}
                        </li>
                      ))}
                    </ul>

                    {config.notes && (
                      <div className="flex gap-2 text-xs text-[var(--tw-mid)] bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <FileText className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        {config.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Procurement note */}
      <section className="py-12 bg-[var(--tw-bg)] border-t border-[var(--tw-border)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="max-w-xl">
              <h2 className="text-lg font-semibold text-[var(--tw-dark)] mb-2">
                Pricing is provided per engagement
              </h2>
              <p className="text-sm text-[var(--tw-mid)] leading-relaxed">
                We do not publish prices because the right configuration depends on your
                specific workload, facility, and procurement requirements. Submit an RFQ
                and we will respond with a scoped proposal within two business days.
              </p>
            </div>
            <Button asChild className="shrink-0">
              <Link href="/contact">
                Submit an RFQ <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Other categories */}
      {otherCategories.length > 0 && (
        <section className="py-12 bg-white border-t border-[var(--tw-border)]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-sm font-semibold text-[var(--tw-muted)] uppercase tracking-wide mb-5">
              Other hardware categories
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {otherCategories.map((other) => (
                <Link
                  key={other.slug}
                  href={`/hardware/${other.slug}`}
                  className="group border border-[var(--tw-border)] rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-[var(--tw-dark)] group-hover:text-[var(--tw-blue)] transition-colors mb-1 text-sm">
                    {other.title}
                  </h3>
                  <p className="text-xs text-[var(--tw-muted)] line-clamp-2">{other.description}</p>
                  <span className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-[var(--tw-blue)]">
                    View <ArrowRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
