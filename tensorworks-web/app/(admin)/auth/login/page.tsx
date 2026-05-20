"use client";

import React from "react";
import { Suspense } from "react";
import { LogoHorizontal } from "@/components/brand/LogoHorizontal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Loader2, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "sent" | "error">(
    error === "invalid" ? "error" : "idle"
  );
  const [errorMsg, setErrorMsg] = React.useState<string | null>(
    error === "invalid" ? "That sign-in link is invalid or has expired. Please request a new one." : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error ?? "Something went wrong.");
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="h-10 w-10 text-[var(--tw-green)] mx-auto mb-3" />
        <h2 className="font-semibold text-[var(--tw-dark)] mb-2">Check your email</h2>
        <p className="text-sm text-[var(--tw-mid)]">
          A sign-in link has been sent to <strong>{email}</strong>. It expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="font-semibold text-[var(--tw-dark)] mb-1">Sign in</h1>
        <p className="text-sm text-[var(--tw-muted)]">
          Enter your email and we will send a sign-in link.
        </p>
      </div>

      {status === "error" && errorMsg && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email address</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@tensorworks.com.au"
          required
          disabled={status === "loading"}
        />
      </div>

      <Button type="submit" className="w-full" disabled={status === "loading" || !email}>
        {status === "loading" ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
        ) : (
          <><Send className="h-4 w-4" /> Send sign-in link</>
        )}
      </Button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--tw-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <LogoHorizontal className="justify-center" markSize={36} />
          <p className="text-sm text-[var(--tw-muted)] mt-2">Admin panel</p>
        </div>

        <div className="bg-white rounded-xl border border-[var(--tw-border)] shadow-sm p-6">
          <Suspense fallback={<div className="h-40 flex items-center justify-center text-sm text-[var(--tw-muted)]">Loading…</div>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
