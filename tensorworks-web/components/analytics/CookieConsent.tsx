"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_COOKIE = "ts-consent";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 365 days

export type ConsentState = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
};

function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match.split("=")[1])) as ConsentState;
  } catch {
    return null;
  }
}

function writeConsent(state: ConsentState) {
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(
    JSON.stringify(state)
  )}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent("ts:consent-changed", { detail: state }));
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const current = readConsent();
    if (!current) setOpen(true);
  }, []);

  function acceptAll() {
    writeConsent({ necessary: true, analytics: true, marketing: true });
    setOpen(false);
  }

  function rejectAll() {
    writeConsent({ necessary: true, analytics: false, marketing: false });
    setOpen(false);
  }

  function savePreferences() {
    writeConsent({ necessary: true, analytics, marketing });
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-[var(--tw-border)] shadow-lg"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
        {!showPrefs ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-sm text-[var(--tw-mid)] leading-relaxed max-w-3xl">
              We use cookies that are strictly necessary for the site to work, plus
              optional analytics cookies (Google Analytics) to understand how the
              site is used. You can review our{" "}
              <Link href="/privacy" className="underline hover:text-[var(--tw-blue)]">
                privacy policy
              </Link>
              .
            </p>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                onClick={() => setShowPrefs(true)}
                className="px-3 py-1.5 text-sm text-[var(--tw-mid)] hover:text-[var(--tw-dark)] border border-[var(--tw-border)] rounded-md hover:bg-[var(--tw-bg)] transition-colors"
              >
                Manage preferences
              </button>
              <button
                onClick={rejectAll}
                className="px-3 py-1.5 text-sm text-[var(--tw-dark)] border border-[var(--tw-border)] rounded-md hover:bg-[var(--tw-bg)] transition-colors"
              >
                Reject all
              </button>
              <button
                onClick={acceptAll}
                className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--tw-blue)] rounded-md hover:opacity-90 transition-opacity"
              >
                Accept all
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="text-sm font-semibold text-[var(--tw-dark)]">
                Cookie preferences
              </h2>
              <button
                onClick={() => setShowPrefs(false)}
                className="text-xs text-[var(--tw-muted)] hover:text-[var(--tw-dark)]"
              >
                ← Back
              </button>
            </div>
            <div className="space-y-3 max-w-3xl">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="mt-1 h-4 w-4 rounded border-[var(--tw-border)]"
                />
                <span>
                  <strong className="text-[var(--tw-dark)]">Necessary</strong>{" "}
                  <span className="text-[var(--tw-muted)]">(always on)</span>
                  <br />
                  <span className="text-[var(--tw-mid)]">
                    Required for the site to function — session, consent, and form submission cookies.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={analytics}
                  onChange={(e) => setAnalytics(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--tw-border)]"
                />
                <span>
                  <strong className="text-[var(--tw-dark)]">Analytics</strong>
                  <br />
                  <span className="text-[var(--tw-mid)]">
                    Google Analytics — anonymised page views and event tracking so we understand which content is useful.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={marketing}
                  onChange={(e) => setMarketing(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[var(--tw-border)]"
                />
                <span>
                  <strong className="text-[var(--tw-dark)]">Marketing</strong>
                  <br />
                  <span className="text-[var(--tw-mid)]">
                    Currently unused. Reserved for advertising and remarketing pixels if we run paid campaigns in future.
                  </span>
                </span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={rejectAll}
                className="px-3 py-1.5 text-sm text-[var(--tw-dark)] border border-[var(--tw-border)] rounded-md hover:bg-[var(--tw-bg)]"
              >
                Reject all
              </button>
              <button
                onClick={savePreferences}
                className="px-4 py-1.5 text-sm font-medium text-white bg-[var(--tw-blue)] rounded-md hover:opacity-90"
              >
                Save preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function readConsentClient(): ConsentState {
  return readConsent() ?? DEFAULT_CONSENT;
}
