import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { siteSEO } from "@/content/seo";
import { CookieConsent } from "@/components/analytics/CookieConsent";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TensorWorks — Australian AI Compute Infrastructure",
    template: "%s | TensorWorks",
  },
  description: siteSEO.defaultDescription,
  metadataBase: new URL(siteSEO.siteUrl),
  openGraph: {
    type: "website",
    siteName: siteSEO.siteName,
    locale: "en_AU",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "TensorWorks — Australian AI Compute Infrastructure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: siteSEO.twitterHandle,
    creator: siteSEO.twitterHandle,
  },
  robots: { index: true, follow: true },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TensorWorks",
  legalName: "TensorWorks Pty Ltd",
  url: siteSEO.siteUrl,
  logo: `${siteSEO.siteUrl}/og-default.png`,
  description: siteSEO.defaultDescription,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bendigo",
    addressRegion: "VIC",
    addressCountry: "AU",
  },
  identifier: {
    "@type": "PropertyValue",
    propertyID: "ABN",
    value: "84 544 119 830",
  },
  sameAs: ["https://www.linkedin.com/company/tensorworks"],
};

const gaId = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU" className={`${inter.variable} h-full`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col antialiased bg-[var(--background)] text-[var(--foreground)] font-sans">
        {children}
        <Toaster />
        <CookieConsent />
      </body>
      {gaId && <GoogleAnalytics gaId={gaId} />}
    </html>
  );
}
