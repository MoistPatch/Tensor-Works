import type { Metadata } from "next";
import Link from "next/link";
import { pageSEO } from "@/content/seo";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: pageSEO["thank-you"].title,
  description: pageSEO["thank-you"].description,
  robots: { index: false, follow: false },
};

export default function ThankYouPage() {
  return (
    <section className="py-32 bg-white flex-1">
      <div className="mx-auto max-w-lg px-4 sm:px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-8 w-8 text-[var(--tw-green)]" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--tw-dark)] mb-4">
          Request received
        </h1>
        <p className="text-[var(--tw-mid)] leading-relaxed mb-8">
          Thank you for your RFQ. Our engineering team will review your requirements
          and respond within two business days. You will receive a confirmation email
          shortly.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/">Return home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/hardware">Browse hardware</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
