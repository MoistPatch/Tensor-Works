"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddClaimForm() {
  const router = useRouter();
  const [pattern, setPattern] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pattern.trim() || !reason.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/news/banned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern: pattern.trim(), reason: reason.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to add claim.");
        return;
      }

      setPattern("");
      setReason("");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-base font-semibold text-[var(--tw-dark)]">Add banned claim</h2>

      {error && (
        <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="pattern"
            className="block text-sm font-medium text-[var(--tw-dark)] mb-1"
          >
            Pattern
          </label>
          <input
            id="pattern"
            type="text"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="e.g. misinformation keyword"
            required
            className="w-full px-3 py-2 rounded-md border border-[var(--tw-border)] text-sm text-[var(--tw-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] focus:border-transparent"
          />
        </div>
        <div>
          <label
            htmlFor="reason"
            className="block text-sm font-medium text-[var(--tw-dark)] mb-1"
          >
            Reason
          </label>
          <input
            id="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this claim is banned"
            required
            className="w-full px-3 py-2 rounded-md border border-[var(--tw-border)] text-sm text-[var(--tw-dark)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] focus:border-transparent"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !pattern.trim() || !reason.trim()}
        className="px-4 py-2 rounded-lg bg-[var(--tw-blue)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {submitting ? "Adding…" : "Add claim"}
      </button>
    </form>
  );
}
