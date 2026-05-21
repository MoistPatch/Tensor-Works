import type { Metadata } from "next";
import Link from "next/link";
import { pageSEO } from "@/content/seo";
import { hardwareCategories } from "@/content/hardware";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: pageSEO.hardware.title,
  description: pageSEO.hardware.description,
};

export default function HardwarePage() {
  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Hardware</h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            GPU training servers, inference systems, workstations, and networking.
            All configurations are burned-in, benchmarked, and documented before delivery.
          </p>
          <div className="flex gap-3 flex-wrap mt-6">
            {hardwareCategories.map((cat) => (
              <Link
                key={cat.slug}
                href={`/hardware/${cat.slug}`}
                className="text-sm text-gray-300 hover:text-white border border-gray-600 hover:border-gray-400 px-3 py-1.5 rounded-full transition-colors"
              >
                {cat.title}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {hardwareCategories.map((category) => (
        <section key={category.slug} id={category.slug} className="py-16 border-b border-[var(--tw-border)] scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-10 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--tw-dark)] mb-2">
                  {category.title}
                </h2>
                <p className="text-[var(--tw-mid)] max-w-2xl">{category.description}</p>
              </div>
              <Link
                href={`/hardware/${category.slug}`}
                className="text-sm font-medium text-[var(--tw-blue)] hover:underline flex items-center gap-1 shrink-0"
              >
                Full specifications <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {category.configurations.map((config) => (
                <div
                  key={config.slug}
                  className="border border-[var(--tw-border)] rounded-lg bg-white hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="p-5 border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
                    <h3 className="font-semibold text-[var(--tw-dark)] mb-1">{config.title}</h3>
                    {config.formFactor && (
                      <Badge variant="secondary" className="text-xs">{config.formFactor}</Badge>
                    )}
                  </div>

                  <div className="p-5 space-y-3 text-sm">
                    {config.gpu !== "N/A" && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-[var(--tw-muted)] font-medium">GPU</span>
                        <span className="text-[var(--tw-dark)]">{config.gpu}</span>
                      </div>
                    )}
                    {config.cpu !== "N/A" && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-[var(--tw-muted)] font-medium">CPU</span>
                        <span className="text-[var(--tw-dark)]">{config.cpu}</span>
                      </div>
                    )}
                    {config.ram !== "N/A" && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-[var(--tw-muted)] font-medium">RAM</span>
                        <span className="text-[var(--tw-dark)]">{config.ram}</span>
                      </div>
                    )}
                    {config.storage !== "N/A" && (
                      <div className="grid grid-cols-[80px_1fr] gap-2">
                        <span className="text-[var(--tw-muted)] font-medium">Storage</span>
                        <span className="text-[var(--tw-dark)]">{config.storage}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-[80px_1fr] gap-2">
                      <span className="text-[var(--tw-muted)] font-medium">Network</span>
                      <span className="text-[var(--tw-dark)]">{config.network}</span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr] gap-2">
                      <span className="text-[var(--tw-muted)] font-medium">Power</span>
                      <span className="text-[var(--tw-dark)]">{config.powerDraw}</span>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-2 border-t border-[var(--tw-border)]">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--tw-mid)] mb-3">
                      <Clock className="h-3.5 w-3.5" />
                      Lead time: {config.leadTime}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {config.useCases.map((uc) => (
                        <Badge key={uc} variant="outline" className="text-xs">{uc}</Badge>
                      ))}
                    </div>
                    {config.notes && (
                      <p className="text-xs text-[var(--tw-muted)] mb-4 italic">{config.notes}</p>
                    )}
                    <Button asChild size="sm" className="w-full">
                      <Link href="/contact">Request a Quote <ArrowRight className="h-3.5 w-3.5" /></Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </>
  );
}
