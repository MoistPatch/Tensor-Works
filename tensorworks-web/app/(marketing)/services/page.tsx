import type { Metadata } from "next";
import Link from "next/link";
import { pageSEO } from "@/content/seo";
import { services } from "@/content/services";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: pageSEO.services.title,
  description: pageSEO.services.description,
};

export default function ServicesPage() {
  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Services</h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            OEM manufacturing, system integration, support contracts, and procurement
            consulting. Engagements are scoped and documented before any commitment.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-12">
            {services.map((service, index) => (
              <div
                key={service.slug}
                id={service.slug}
                className="scroll-mt-20 grid grid-cols-1 lg:grid-cols-5 gap-8 pb-12 border-b border-[var(--tw-border)] last:border-0 last:pb-0"
              >
                <div className="lg:col-span-2">
                  <div className="sticky top-24">
                    <span className="text-xs font-semibold text-[var(--tw-muted)] uppercase tracking-widest mb-2 block">
                      0{index + 1}
                    </span>
                    <h2 className="text-2xl font-bold text-[var(--tw-dark)] mb-2">
                      {service.title}
                    </h2>
                    <p className="text-[var(--tw-blue)] font-medium mb-4">{service.subtitle}</p>
                    <p className="text-sm text-[var(--tw-mid)] leading-relaxed mb-6">
                      {service.description}
                    </p>
                    <Button asChild size="sm">
                      <Link href="/contact">
                        Enquire <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="lg:col-span-3 space-y-6">
                  <div className="bg-[var(--tw-bg)] rounded-lg p-5">
                    <h3 className="text-sm font-semibold text-[var(--tw-dark)] mb-3 uppercase tracking-wider">
                      Engagement model
                    </h3>
                    <p className="text-sm text-[var(--tw-mid)] leading-relaxed">
                      {service.engagementModel}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-[var(--tw-dark)] mb-3 uppercase tracking-wider">
                      Deliverables
                    </h3>
                    <ul className="space-y-2.5">
                      {service.deliverables.map((d) => (
                        <li key={d} className="flex items-start gap-2.5 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-[var(--tw-green)] flex-shrink-0 mt-0.5" />
                          <span className="text-[var(--tw-dark)]">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="border border-[var(--tw-border)] rounded-lg p-4 inline-flex items-center gap-2 text-sm">
                    <span className="font-medium text-[var(--tw-dark)]">Typical timeline:</span>
                    <span className="text-[var(--tw-mid)]">{service.typicalTimeline}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
