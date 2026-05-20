import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
  },
  robots: { index: true, follow: true },
};

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
    </html>
  );
}
