import type { Metadata } from "next";
import Link from "next/link";
import { pageSEO } from "@/content/seo";
import { solutions } from "@/content/solutions";
import { services } from "@/content/services";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Shield, Cpu, Zap, Globe } from "lucide-react";

export const metadata: Metadata = {
  title: pageSEO.home.title,
  description: pageSEO.home.description,
};

const trustPoints = [
  {
    icon: Shield,
    heading: "Sovereign supply chain",
    body: "Australian-documented provenance for government, defence, and research procurement requirements.",
  },
  {
    icon: Cpu,
    heading: "Configured, not just shipped",
    body: "Every system is burned-in, benchmarked, and documented before it leaves our facility.",
  },
  {
    icon: Zap,
    heading: "Built for the workload",
    body: "GPU interconnects, storage I/O, and cooling sized to the actual workload — not a catalogue SKU.",
  },
  {
    icon: Globe,
    heading: "Local support",
    body: "When something fails, you talk to the team that configured the system — not an overseas queue.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-[var(--tw-dark)] text-white py-24 md:py-32 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_30%_20%,#1F5C99_0%,transparent_60%),radial-gradient(circle_at_80%_80%,#76B900_0%,transparent_50%)]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Badge variant="accent" className="mb-6">
              Australian AI Compute
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
              GPU infrastructure
              <br />
              <span className="text-[var(--tw-blue-light)]">built for the workload.</span>
            </h1>
            <p className="text-lg md:text-xl text-gray-300 leading-relaxed mb-10 max-w-2xl">
              TensorWorks designs, integrates, and supports GPU compute systems for
              Australian research institutions, enterprises, and government. Configured
              and tested before delivery. Supported by the team that built it.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button asChild size="xl">
                <Link href="/contact">
                  Request a Quote <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline" className="border-gray-500 text-white hover:bg-white/10 hover:border-white">
                <Link href="/hardware">View Hardware</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust points */}
      <section className="py-20 bg-[var(--tw-bg)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {trustPoints.map((point) => (
              <div key={point.heading} className="flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--tw-blue)] flex items-center justify-center flex-shrink-0">
                  <point.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-semibold text-[var(--tw-dark)]">{point.heading}</h3>
                <p className="text-sm text-[var(--tw-mid)] leading-relaxed">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--tw-dark)] mb-3">
              Solutions
            </h2>
            <p className="text-[var(--tw-mid)] max-w-xl">
              Infrastructure matched to the workload — from foundation model training
              to field-deployed edge AI.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {solutions.map((solution) => (
              <Link key={solution.slug} href={`/solutions/${solution.slug}`} className="group">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg group-hover:text-[var(--tw-blue)] transition-colors">
                      {solution.title}
                    </CardTitle>
                    <CardDescription>{solution.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-[var(--tw-mid)] leading-relaxed line-clamp-3">
                      {solution.description}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-[var(--tw-blue)] group-hover:gap-2 transition-all">
                      Learn more <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Services highlight */}
      <section className="py-20 bg-[var(--tw-bg)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl font-bold tracking-tight text-[var(--tw-dark)] mb-3">
              How we work
            </h2>
            <p className="text-[var(--tw-mid)] max-w-xl">
              From OEM manufacturing to ongoing support contracts — engagements are
              structured, documented, and scoped before any commitment.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((service) => (
              <Link key={service.slug} href={`/services#${service.slug}`} className="group">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="text-lg group-hover:text-[var(--tw-blue)] transition-colors">
                      {service.title}
                    </CardTitle>
                    <CardDescription>{service.subtitle}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-[var(--tw-mid)] leading-relaxed line-clamp-2">
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[var(--tw-blue)] text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Ready to specify your system?
          </h2>
          <p className="text-blue-100 max-w-xl mx-auto mb-8 leading-relaxed">
            Submit an RFQ and our engineering team will respond with a scoped proposal
            — typically within two business days.
          </p>
          <Button asChild size="xl" variant="accent">
            <Link href="/contact">
              Submit an RFQ <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
