import type { Metadata } from "next";
import Link from "next/link";
import { pageSEO } from "@/content/seo";
import { solutions } from "@/content/solutions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: pageSEO.solutions.title,
  description: pageSEO.solutions.description,
};

export default function SolutionsPage() {
  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Solutions</h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            Infrastructure matched to the workload. Each configuration is designed
            around the actual compute requirements — not a generic appliance.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8">
            {solutions.map((solution) => (
              <Card key={solution.slug} className="overflow-hidden">
                <div className="md:grid md:grid-cols-3 gap-0">
                  <CardHeader className="md:col-span-1 bg-[var(--tw-bg)] md:rounded-none">
                    <CardTitle className="text-xl">{solution.title}</CardTitle>
                    <CardDescription className="text-sm">{solution.subtitle}</CardDescription>
                    <div className="pt-2">
                      <Button asChild size="sm">
                        <Link href={`/solutions/${solution.slug}`}>
                          View details <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="md:col-span-2 p-6">
                    <p className="text-sm text-[var(--tw-mid)] leading-relaxed mb-6">
                      {solution.description}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {solution.capabilities.map((cap) => (
                        <div key={cap} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-[var(--tw-green)] flex-shrink-0 mt-0.5" />
                          <span className="text-[var(--tw-dark)]">{cap}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
