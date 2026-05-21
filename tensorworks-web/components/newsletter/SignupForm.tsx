"use client";

import React, { useState, useRef } from "react";
import { trackEvent } from "@/components/analytics/GoogleAnalytics";

interface SignupFormProps {
  variant?: "default" | "compact";
}

type FormState = "idle" | "loading" | "success" | "error";

export function SignupForm({ variant = "default" }: SignupFormProps) {
  const [state, setState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const emailRef = useRef<HTMLInputElement>(null);
  const consentRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = emailRef.current?.value.trim() ?? "";

    if (!email) return;

    if (variant === "default") {
      const consent = consentRef.current?.checked ?? false;
      if (!consent) {
        setErrorMessage("Please tick the consent box to subscribe.");
        setState("error");
        return;
      }
    }

    setState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent: true }),
      });

      const result = await response.json();

      if (!response.ok) {
        setErrorMessage(
          result.error ?? "Something went wrong. Please try again."
        );
        setState("error");
        return;
      }

      setState("success");
      trackEvent("newsletter_subscribed", { source: variant });
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setState("error");
    }
  }

  if (variant === "compact") {
    if (state === "success") {
      return (
        <p className="text-sm text-[var(--tw-green)] font-medium">
          Check your email — we&apos;ve sent a confirmation link.
        </p>
      );
    }

    return (
      <div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="flex gap-2">
            <input
              ref={emailRef}
              type="email"
              name="email"
              required
              placeholder="your@email.com"
              disabled={state === "loading"}
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-md border border-[var(--tw-border,#e5e7eb)] bg-white text-[var(--tw-dark)] placeholder:text-[var(--tw-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="px-4 py-2 text-sm font-medium text-white bg-[var(--tw-blue)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-60 whitespace-nowrap"
            >
              {state === "loading" ? "Subscribing…" : "Subscribe"}
            </button>
          </div>
          {state === "error" && (
            <p className="mt-2 text-xs text-red-600">{errorMessage}</p>
          )}
        </form>
        <p className="mt-2 text-xs text-[var(--tw-muted)]">
          By subscribing you consent to receive marketing emails. Unsubscribe any time.
        </p>
      </div>
    );
  }

  // Default variant
  if (state === "success") {
    return (
      <p className="text-sm text-[var(--tw-green)] font-medium text-center">
        Check your email — we&apos;ve sent a confirmation link.
      </p>
    );
  }

  return (
    <div>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div>
          <label htmlFor="newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="newsletter-email"
            ref={emailRef}
            type="email"
            name="email"
            required
            placeholder="your@email.com"
            disabled={state === "loading"}
            className="w-full px-4 py-2.5 text-sm rounded-md border border-[var(--tw-border,#e5e7eb)] bg-white text-[var(--tw-dark)] placeholder:text-[var(--tw-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] disabled:opacity-60"
          />
        </div>

        <div className="flex items-start gap-2.5">
          <input
            id="newsletter-consent"
            ref={consentRef}
            type="checkbox"
            name="consent"
            disabled={state === "loading"}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[var(--tw-blue)] focus:ring-[var(--tw-blue)] disabled:opacity-60"
          />
          <label htmlFor="newsletter-consent" className="text-sm text-[var(--tw-mid)] leading-snug">
            I&apos;d like to receive fortnightly insights from TensorWorks on AI hardware and infrastructure.
          </label>
        </div>

        <button
          type="submit"
          disabled={state === "loading"}
          className="w-full px-4 py-2.5 text-sm font-medium text-white bg-[var(--tw-blue)] rounded-md hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {state === "loading" ? "Subscribing…" : "Subscribe"}
        </button>

        {state === "error" && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}
      </form>
    </div>
  );
}
