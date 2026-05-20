import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribed — TensorWorks",
  description: "You've been removed from the TensorWorks Insights mailing list.",
  robots: { index: false, follow: false },
};

export default function UnsubscribedPage() {
  return (
    <>
      <section className="bg-[var(--tw-dark)] text-white py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            You&apos;ve been unsubscribed
          </h1>
          <p className="text-gray-300 text-lg max-w-2xl">
            You&apos;ve been removed from the TensorWorks Insights list.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white flex-1">
        <div className="mx-auto max-w-lg px-4 sm:px-6">
          <p className="text-[var(--tw-mid)] leading-relaxed mb-8">
            You won&apos;t receive any further emails from us regarding AI hardware insights and
            infrastructure updates. If you have feedback or questions, feel free to{" "}
            <Link href="/contact" className="text-[var(--tw-blue)] hover:underline">
              get in touch
            </Link>
            .
          </p>

          <p className="text-sm text-[var(--tw-mid)]">
            Unsubscribed by mistake?{" "}
            <Link
              href="/insights"
              className="text-[var(--tw-blue)] hover:underline font-medium"
            >
              Resubscribe here
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
