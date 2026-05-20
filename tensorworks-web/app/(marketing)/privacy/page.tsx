import type { Metadata } from "next";
import { pageSEO } from "@/content/seo";

export const metadata: Metadata = {
  title: pageSEO.privacy.title,
  description: pageSEO.privacy.description,
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <section className="py-16 bg-white">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-[var(--tw-dark)] mb-2">Privacy Policy</h1>
        <p className="text-sm text-[var(--tw-muted)] mb-10">Last updated: 20 May 2026</p>

        <div className="prose">
          <h2>Information we collect</h2>
          <p>
            When you submit a Request for Quote (RFQ) through our website, we collect the
            information you provide: your name, company name, ABN, email address, phone
            number, and the technical requirements you describe. We also record your IP
            address and browser user agent for spam prevention purposes.
          </p>

          <h2>How we use your information</h2>
          <p>
            We use the information you provide to evaluate your requirements, prepare a
            proposal, and contact you about your enquiry. We may also create a contact and
            deal record in our CRM (HubSpot) to manage the engagement.
          </p>
          <p>
            We do not sell your personal information to third parties. We do not use your
            information for advertising purposes.
          </p>

          <h2>Data retention</h2>
          <p>
            We retain RFQ submissions and related correspondence for seven years in
            accordance with Australian business record-keeping requirements.
          </p>

          <h2>Your rights</h2>
          <p>
            Under the Australian Privacy Act 1988, you have the right to access and
            correct personal information we hold about you. To make a request, contact us
            at privacy@tensorworks.com.au.
          </p>

          <h2>Cookies</h2>
          <p>
            We use essential cookies for site functionality and, if enabled, analytics
            cookies (Google Analytics) to understand how the site is used. Analytics
            cookies are only set with your consent.
          </p>

          <h2>Contact</h2>
          <p>
            For privacy enquiries, contact privacy@tensorworks.com.au.
          </p>
        </div>
      </div>
    </section>
  );
}
