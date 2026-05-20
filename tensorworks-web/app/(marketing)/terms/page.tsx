import type { Metadata } from "next";
import { pageSEO } from "@/content/seo";

export const metadata: Metadata = {
  title: pageSEO.terms.title,
  description: pageSEO.terms.description,
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <section className="py-16 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-[var(--tw-dark)] mb-2">Terms of Service</h1>
        <p className="text-sm text-[var(--tw-muted)] mb-10">Last updated: [date pending]</p>

        <div className="prose">
          <h2>Use of this website</h2>
          <p>
            This website is operated by TensorWorks Pty Ltd (ABN: [ABN pending]). By
            accessing this website, you agree to these terms. If you do not agree, please
            do not use this website.
          </p>

          <h2>Requests for Quote</h2>
          <p>
            Submitting an RFQ does not constitute a binding agreement. RFQ submissions are
            an expression of interest only. Any binding agreement requires a signed
            Statement of Work or purchase order accepted by TensorWorks Pty Ltd.
          </p>

          <h2>Information accuracy</h2>
          <p>
            Hardware specifications, lead times, and other information on this website are
            indicative only and subject to change. Final specifications are confirmed in
            the Statement of Work.
          </p>

          <h2>Intellectual property</h2>
          <p>
            All content on this website is the property of TensorWorks Pty Ltd unless
            otherwise noted. You may not reproduce or redistribute content without written
            permission.
          </p>

          <h2>Limitation of liability</h2>
          <p>
            To the maximum extent permitted by Australian law, TensorWorks Pty Ltd is not
            liable for any indirect, incidental, or consequential loss arising from the use
            of this website or reliance on information contained herein.
          </p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by the laws of New South Wales, Australia.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms: legal@tensorworks.com.au.
          </p>
        </div>
      </div>
    </section>
  );
}
