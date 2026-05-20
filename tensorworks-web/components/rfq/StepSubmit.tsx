"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { RFQFull } from "@/lib/validations/rfq";
import { ArrowLeft, Send, Loader2 } from "lucide-react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
    };
  }
}

interface StepSubmitProps {
  form: UseFormReturn<RFQFull>;
  onBack: () => void;
  isSubmitting: boolean;
}

export function StepSubmit({ form, onBack, isSubmitting }: StepSubmitProps) {
  const widgetRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  React.useEffect(() => {
    if (!siteKey || !widgetRef.current) return;

    function renderWidget() {
      if (!window.turnstile || !widgetRef.current) return;
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          form.setValue("turnstileToken", token);
        },
        "expired-callback": () => {
          form.setValue("turnstileToken", "");
        },
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    }
  }, [siteKey, form]);

  return (
    <div className="space-y-6">
      <div className="bg-[var(--tw-bg)] rounded-lg p-5">
        <p className="text-sm text-[var(--tw-mid)] leading-relaxed">
          You are about to submit your RFQ to TensorWorks. Our engineering team will
          review your requirements and respond within two business days. You will
          receive a confirmation email at the address you provided.
        </p>
      </div>

      <FormField
        control={form.control}
        name="referralSource"
        render={({ field }) => (
          <FormItem>
            <FormLabel>How did you hear about us?</FormLabel>
            <FormControl>
              <Input
                placeholder="Google, referral, conference, LinkedIn..."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div>
        <div ref={widgetRef} />
        <FormField
          control={form.control}
          name="turnstileToken"
          render={() => (
            <FormItem>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
            </>
          ) : (
            <>
              Submit RFQ <Send className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
