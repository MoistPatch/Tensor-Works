import type { Metadata } from "next";
import Link from "next/link";
import { pageSEO } from "@/content/seo";
import { solutions } from "@/content/solutions";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: pageSEO.solutions.title,
  description: pageSEO.solutions.description,
};

export default function SolutionsPage() {
  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-5">Solutions</h1>
            <p className="text-gray-300 text-lg md:text-xl leading-relaxed max-w-2xl">
              Every deployment is scoped to the workload. We do not publish
              catalogue configurations because the right system depends on what
              you are actually running — model size, parallelism strategy, storage
              access patterns, and operating environment.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[var(--tw-bg)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--tw-blue)] flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-[var(--tw-dark)]">Configured for the workload</h3>
              <p className="text-sm text-[var(--tw-mid)] leading-relaxed">
                GPU interconnect, storage I/O, cooling, and power are sized to
                what you are running — not to a generic appliance specification.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--tw-blue)] flex items-center justify-center">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-[var(--tw-dark)]">Sovereign supply chain</h3>
              <p className="text-sm text-[var(--tw-mid)] leading-relaxed">
                Full provenance documentation for government, defence, and
                research procurement — ITAR compliance assessments included
                where required.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--tw-green)] flex items-center justify-center">
                <ArrowRight className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-[var(--tw-dark)]">Validated before delivery</h3>
              <p className="text-sm text-[var(--tw-mid)] leading-relaxed">
                Every system runs a full burn-in under production load before it
                leaves our facility. You receive benchmark data and test reports
                at handover.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-0 divide-y divide-[var(--tw-border)]">
            {solutions.map((solution, index) => (
              <div key={solution.slug} className="py-12 first:pt-0 last:pb-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                  <div className="lg:col-span-4">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-xs font-mono text-[var(--tw-muted)] mt-1">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <h2 className="text-2xl font-bold text-[var(--tw-dark)]">
                          {solution.title}
                        </h2>
                        {solution.agsvaCleared && (
                          <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium bg-[var(--tw-blue)]/10 text-[var(--tw-blue)] border border-[var(--tw-blue)]/20 rounded-full px-2.5 py-0.5">
                            <Shield className="h-3 w-3" />
                            AGSVA cleared personnel
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-[var(--tw-blue)] mb-4 ml-7">
                      {solution.tagline}
                    </p>
                    <div className="ml-7">
                      <Button asChild size="sm">
                        <Link href={`/solutions/${solution.slug}`}>
                          View solution details <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <p className="text-[var(--tw-mid)] leading-relaxed text-sm mb-5">
                      {solution.description}
                    </p>
                    <ul className="space-y-2">
                      {solution.capabilities.slice(0, 4).map((cap) => (
                        <li key={cap} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-[var(--tw-green)] flex-shrink-0 mt-0.5" />
                          <span className="text-[var(--tw-dark)]">{cap}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="lg:col-span-3">
                    <p className="text-xs font-medium text-[var(--tw-muted)] uppercase tracking-wide mb-3">
                      Use cases
                    </p>
                    <ul className="space-y-1.5">
                      {solution.useCases.map((uc) => (
                        <li key={uc} className="text-sm text-[var(--tw-mid)]">
                          {uc}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[var(--tw-dark)] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Not sure which solution fits?</h2>
              <p className="text-gray-400 max-w-lg">
                Submit an RFQ describing your workload and constraints. Our engineering
                team will respond with a scoped proposal — typically within two business days.
              </p>
            </div>
            <Button asChild size="lg" variant="accent" className="shrink-0">
              <Link href="/contact">
                Submit an RFQ <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
