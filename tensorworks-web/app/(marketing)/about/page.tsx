import type { Metadata } from "next";
import Link from "next/link";
import { pageSEO } from "@/content/seo";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: pageSEO.about.title,
  description: pageSEO.about.description,
};

export default function AboutPage() {
  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">About</h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            TensorWorks is an Australian company that designs, integrates, and supports
            GPU compute systems for AI workloads.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-12">
            <div className="prose">
              <h2>What we do</h2>
              <p>
                We build GPU infrastructure for Australian organisations that need to run
                AI workloads on-premise — research institutions, enterprises, and government
                agencies that cannot or choose not to depend on hyperscaler compute.
              </p>
              <p>
                Our work spans the full stack: mechanical design and component sourcing for
                OEM customers, system integration and burn-in testing for enterprise deployments,
                and ongoing hardware support contracts for production systems.
              </p>

              <h2>Why on-premise</h2>
              <p>
                There are workloads that should not leave a specific jurisdiction. Training
                data with privacy obligations, classified information processing, research
                data with sovereignty requirements, and applications where round-trip latency
                to a hyperscaler region is a hard constraint.
              </p>
              <p>
                For these workloads, the compute needs to sit in a specific facility, under
                specific governance, with documented provenance. That is what we build.
              </p>

              <h2>How we work</h2>
              <p>
                Engagements start with a scoping conversation. We understand the workload,
                the facility constraints, the procurement requirements, and the support
                expectations before we propose anything. The proposal takes the form of a
                Statement of Work — specifications, unit economics, timeline, and deliverables.
              </p>
              <p>
                We do not publish prices because the right configuration depends on the workload.
                A system that is over-provisioned on GPU memory and under-provisioned on storage
                I/O will not perform as expected regardless of the GPU count.
              </p>

              <h2>Supply chain</h2>
              <p>
                We maintain direct relationships with component suppliers and work with
                Australian-based distributors where available. For government and defence
                customers, we can provide full supply chain provenance documentation,
                ITAR compliance assessments, and Australian Industry Participation plans.
              </p>
            </div>

            <div className="border-t border-[var(--tw-border)] pt-10">
              <h2 className="text-xl font-bold text-[var(--tw-dark)] mb-4">Get in touch</h2>
              <p className="text-[var(--tw-mid)] mb-6 leading-relaxed">
                If you have a workload that needs on-premise GPU infrastructure, start with
                an RFQ. We will respond with a proposal within two business days.
              </p>
              <Button asChild>
                <Link href="/contact">
                  Submit an RFQ <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
