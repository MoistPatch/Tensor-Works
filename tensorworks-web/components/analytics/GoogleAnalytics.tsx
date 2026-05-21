"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { readConsentClient } from "./CookieConsent";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export function GoogleAnalytics({ gaId }: { gaId: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readConsentClient().analytics);
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { analytics: boolean };
      setEnabled(detail.analytics);
    };
    window.addEventListener("ts:consent-changed", handler as EventListener);
    return () => window.removeEventListener("ts:consent-changed", handler as EventListener);
  }, []);

  if (!enabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());gtag('config','${gaId}',{anonymize_ip:true});`}
      </Script>
    </>
  );
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params ?? {});
}
