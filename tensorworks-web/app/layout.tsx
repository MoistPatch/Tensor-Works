import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { siteSEO } from "@/content/seo";

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

const gaId = process.env.NEXT_PUBLIC_GA_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased bg-[var(--background)] text-[var(--foreground)] font-sans">
        {children}
        <Toaster />
      </body>
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${gaId}',{page_path:window.location.pathname});`}
          </Script>
        </>
      )}
    </html>
  );
}
