import type { Metadata } from "next";
import { pageSEO } from "@/content/seo";
import { RFQForm } from "@/components/rfq/RFQForm";
import { Mail, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: pageSEO.contact.title,
  description: pageSEO.contact.description,
};

export default function ContactPage() {
  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Request a Quote
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            Tell us about your requirements and we will respond with a scoped
            proposal within two business days.
          </p>
        </div>
      </section>

      <section className="py-16 bg-[var(--tw-bg)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-[var(--tw-border)] p-6 md:p-8 shadow-sm">
                <RFQForm />
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[var(--tw-border)] p-6">
                <h2 className="font-semibold text-[var(--tw-dark)] mb-4">What happens next</h2>
                <ol className="space-y-4">
                  {[
                    "We review your RFQ and assess the requirements",
                    "Our engineering team prepares a configuration recommendation",
                    "We respond with a scoped proposal within two business days",
                    "A scoping call to walk through the proposal if needed",
                    "Statement of Work agreed before any commitment",
                  ].map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="w-5 h-5 rounded-full bg-[var(--tw-blue)] text-white flex items-center justify-center flex-shrink-0 text-xs font-semibold mt-0.5">
                        {i + 1}
                      </span>
                      <span className="text-[var(--tw-mid)]">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="bg-white rounded-xl border border-[var(--tw-border)] p-6 space-y-4">
                <h2 className="font-semibold text-[var(--tw-dark)]">Direct contact</h2>
                <div className="flex items-center gap-2.5 text-sm text-[var(--tw-mid)]">
                  <Mail className="h-4 w-4 text-[var(--tw-blue)] flex-shrink-0" />
                  <a
                    href="mailto:enquiries@tensorworks.com.au"
                    className="hover:text-[var(--tw-blue)] transition-colors"
                  >
                    enquiries@tensorworks.com.au
                  </a>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-[var(--tw-mid)]">
                  <Clock className="h-4 w-4 text-[var(--tw-blue)] flex-shrink-0" />
                  <span>AEST business hours, Monday to Friday</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
