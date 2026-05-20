import type { Metadata } from "next";
import { pageSEO } from "@/content/seo";

export const metadata: Metadata = {
  title: pageSEO.insights.title,
  description: pageSEO.insights.description,
};

export default function InsightsPage() {
  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Insights</h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            Technical articles and guidance on AI compute infrastructure from the
            TensorWorks engineering team.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center py-20">
            <p className="text-[var(--tw-muted)] text-sm uppercase tracking-widest mb-4">Coming soon</p>
            <h2 className="text-2xl font-bold text-[var(--tw-dark)] mb-4">
              Articles in preparation
            </h2>
            <p className="text-[var(--tw-mid)] leading-relaxed">
              We are preparing technical content on GPU cluster configuration, InfiniBand
              fabric design, and sovereign procurement approaches for AI hardware. Check
              back soon.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
