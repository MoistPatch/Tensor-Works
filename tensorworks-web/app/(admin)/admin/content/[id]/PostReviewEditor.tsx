"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface GenerationLog {
  qualityScore: number | null;
  qualityReport: Record<string, unknown> | null;
}

interface Citation {
  title: string;
  url: string;
  accessed: string;
}

interface Post {
  id: string;
  title: string;
  subtitle: string;
  body: string;
  tier: string;
  category: string;
  status: string;
  wordCount: number;
  modelUsed: string | null;
  generationCost: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  reviewNotes: string;
  citations: Citation[];
  generationLog: GenerationLog | null;
}

interface Props {
  post: Post;
  nextPostId: string | null;
}

const TIER_LABELS: Record<string, string> = {
  "deep-analysis": "Deep Analysis",
  "weekly-digest": "Weekly Digest",
  "daily-scan": "Daily Scan",
};

function TierBadge({ tier }: { tier: string }) {
  if (tier === "deep-analysis") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-blue)] text-white">
        {TIER_LABELS[tier] ?? tier}
      </span>
    );
  }
  if (tier === "weekly-digest") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-green)] text-white">
        {TIER_LABELS[tier] ?? tier}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-200 text-[var(--tw-dark)]">
      {TIER_LABELS[tier] ?? tier}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    pending_review: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    rejected: "bg-red-100 text-red-700",
    published: "bg-[var(--tw-blue)] text-white",
    draft: "bg-gray-200 text-[var(--tw-dark)]",
  };
  const labels: Record<string, string> = {
    pending_review: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    published: "Published",
    draft: "Draft",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[status] ?? "bg-gray-200 text-[var(--tw-dark)]"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function PostReviewEditor({ post, nextPostId }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(post.title);
  const [subtitle, setSubtitle] = useState(post.subtitle);
  const [reviewNotes, setReviewNotes] = useState(post.reviewNotes);
  const [status, setStatus] = useState(post.status);
  const [editingBody, setEditingBody] = useState(false);
  const [bodyDraft, setBodyDraft] = useState(post.body);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showMsg = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setSuccessMsg(null);
    } else {
      setSuccessMsg(msg);
      setErrorMsg(null);
    }
    setTimeout(() => {
      setErrorMsg(null);
      setSuccessMsg(null);
    }, 4000);
  };

  const handleApprove = useCallback(async () => {
    setActionLoading("approve");
    try {
      const res = await fetch(`/api/admin/content/${post.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("approved");
      showMsg("Post approved.");
    } catch {
      showMsg("Failed to approve post.", true);
    } finally {
      setActionLoading(null);
    }
  }, [post.id, reviewNotes]);

  const handleReject = useCallback(async () => {
    setActionLoading("reject");
    try {
      const res = await fetch(`/api/admin/content/${post.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("rejected");
      showMsg("Post rejected.");
    } catch {
      showMsg("Failed to reject post.", true);
    } finally {
      setActionLoading(null);
    }
  }, [post.id, reviewNotes]);

  const handleRegenerate = useCallback(async () => {
    setActionLoading("regenerate");
    try {
      const res = await fetch(`/api/admin/content/${post.id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("draft");
      showMsg("Post queued for re-generation.");
    } catch {
      showMsg("Failed to queue re-generation.", true);
    } finally {
      setActionLoading(null);
    }
  }, [post.id]);

  const handleSaveEdit = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/content/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle, body: bodyDraft }),
      });
      if (!res.ok) throw new Error("Request failed");
      setEditingBody(false);
      showMsg("Changes saved.");
    } catch {
      showMsg("Failed to save changes.", true);
    } finally {
      setSaving(false);
    }
  }, [post.id, title, subtitle, bodyDraft]);

  const handleNext = useCallback(() => {
    if (nextPostId) {
      router.push(`/admin/content/${nextPostId}`);
    }
  }, [nextPostId, router]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't fire shortcuts when focus is on an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "a":
          e.preventDefault();
          handleApprove();
          break;
        case "r":
          e.preventDefault();
          handleReject();
          break;
        case "e":
          e.preventDefault();
          setEditingBody((prev) => !prev);
          break;
        case "g":
          e.preventDefault();
          handleRegenerate();
          break;
        case "n":
          e.preventDefault();
          handleNext();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleApprove, handleReject, handleRegenerate, handleNext]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/content"
            className="text-sm text-[var(--tw-muted)] hover:text-[var(--tw-dark)] transition-colors"
          >
            ← Content Queue
          </Link>
          <span className="text-[var(--tw-border)]">/</span>
          <span className="text-sm text-[var(--tw-dark)] font-medium truncate max-w-xs">
            {title}
          </span>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Toast messages */}
      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Main content */}
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-[var(--tw-muted)] mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[var(--tw-border)] px-3 py-2 text-base font-semibold text-[var(--tw-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] bg-white"
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-xs font-medium text-[var(--tw-muted)] mb-1">
              Subtitle
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="w-full rounded-lg border border-[var(--tw-border)] px-3 py-2 text-sm text-[var(--tw-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] bg-white"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-[var(--tw-muted)]">
                Body
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingBody((prev) => !prev)}
                className="text-xs h-6 px-2"
              >
                {editingBody ? "Preview" : "[E] Edit"}
              </Button>
            </div>

            {editingBody ? (
              <div className="space-y-2">
                <textarea
                  value={bodyDraft}
                  onChange={(e) => setBodyDraft(e.target.value)}
                  rows={30}
                  className="w-full rounded-lg border border-[var(--tw-border)] px-3 py-2 text-sm text-[var(--tw-dark)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] bg-white resize-y"
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={saving}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBodyDraft(post.body);
                      setEditingBody(false);
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="w-full rounded-lg border border-[var(--tw-border)] bg-white p-4 prose prose-sm max-w-none overflow-auto max-h-[70vh]"
                dangerouslySetInnerHTML={{ __html: bodyDraft }}
              />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="bg-white rounded-xl border border-[var(--tw-border)] p-4 space-y-2">
            <h3 className="text-sm font-semibold text-[var(--tw-dark)] mb-3">Actions</h3>

            <Button
              className="w-full justify-between"
              variant="accent"
              onClick={handleApprove}
              disabled={actionLoading !== null}
            >
              <span>Approve</span>
              <kbd className="text-xs opacity-60 font-mono">A</kbd>
            </Button>

            <Button
              className="w-full justify-between"
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading !== null}
            >
              <span>Reject</span>
              <kbd className="text-xs opacity-60 font-mono">R</kbd>
            </Button>

            <Button
              className="w-full justify-between"
              variant="outline"
              onClick={() => setEditingBody((prev) => !prev)}
            >
              <span>Edit body</span>
              <kbd className="text-xs opacity-60 font-mono text-[var(--tw-muted)]">E</kbd>
            </Button>

            <Button
              className="w-full justify-between"
              variant="secondary"
              onClick={handleRegenerate}
              disabled={actionLoading !== null}
            >
              <span>Re-generate</span>
              <kbd className="text-xs opacity-60 font-mono text-[var(--tw-muted)]">G</kbd>
            </Button>

            {nextPostId && (
              <Button
                className="w-full justify-between"
                variant="ghost"
                onClick={handleNext}
              >
                <span>Next post</span>
                <kbd className="text-xs opacity-60 font-mono text-[var(--tw-muted)]">N</kbd>
              </Button>
            )}
          </div>

          {/* Review notes */}
          <div className="bg-white rounded-xl border border-[var(--tw-border)] p-4">
            <label className="block text-xs font-medium text-[var(--tw-muted)] mb-2">
              Review notes
            </label>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={4}
              placeholder="Optional notes submitted with Approve / Reject…"
              className="w-full rounded-lg border border-[var(--tw-border)] px-3 py-2 text-sm text-[var(--tw-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] bg-white resize-none"
            />
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-[var(--tw-border)] p-4 space-y-3 text-sm">
            <h3 className="text-sm font-semibold text-[var(--tw-dark)]">Metadata</h3>

            <div className="flex items-center justify-between">
              <span className="text-[var(--tw-muted)]">Tier</span>
              <TierBadge tier={post.tier} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--tw-muted)]">Category</span>
              <span className="text-[var(--tw-dark)] capitalize">{post.category}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--tw-muted)]">Word count</span>
              <span className="text-[var(--tw-dark)] tabular-nums">
                {post.wordCount.toLocaleString("en-AU")}
              </span>
            </div>

            {post.modelUsed && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--tw-muted)]">Model</span>
                <span className="text-[var(--tw-dark)] font-mono text-xs">{post.modelUsed}</span>
              </div>
            )}

            {post.generationCost != null && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--tw-muted)]">Cost (AUD)</span>
                <span className="text-[var(--tw-dark)] tabular-nums">
                  ${post.generationCost.toFixed(4)}
                </span>
              </div>
            )}

            {post.promptTokens != null && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--tw-muted)]">Prompt tokens</span>
                <span className="text-[var(--tw-dark)] tabular-nums">
                  {post.promptTokens.toLocaleString("en-AU")}
                </span>
              </div>
            )}

            {post.completionTokens != null && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--tw-muted)]">Completion tokens</span>
                <span className="text-[var(--tw-dark)] tabular-nums">
                  {post.completionTokens.toLocaleString("en-AU")}
                </span>
              </div>
            )}
          </div>

          {/* Quality report */}
          {post.generationLog && (
            <div className="bg-white rounded-xl border border-[var(--tw-border)] p-4 space-y-3 text-sm">
              <h3 className="text-sm font-semibold text-[var(--tw-dark)]">Quality</h3>

              {post.generationLog.qualityScore != null && (
                <div className="flex items-center justify-between">
                  <span className="text-[var(--tw-muted)]">Score</span>
                  <span className="text-[var(--tw-dark)] tabular-nums font-semibold">
                    {(post.generationLog.qualityScore * 100).toFixed(0)}%
                  </span>
                </div>
              )}

              {post.generationLog.qualityReport && (
                <details className="text-xs">
                  <summary className="text-[var(--tw-muted)] cursor-pointer hover:text-[var(--tw-dark)]">
                    Full report
                  </summary>
                  <pre className="mt-2 bg-[var(--tw-bg)] rounded p-2 overflow-auto text-[var(--tw-dark)] whitespace-pre-wrap break-all">
                    {JSON.stringify(post.generationLog.qualityReport, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}

          {/* Citations */}
          {post.citations.length > 0 && (
            <div className="bg-white rounded-xl border border-[var(--tw-border)] p-4 space-y-2">
              <h3 className="text-sm font-semibold text-[var(--tw-dark)] mb-2">
                Citations ({post.citations.length})
              </h3>
              <ul className="space-y-2">
                {post.citations.map((cite, i) => (
                  <li key={i} className="text-xs">
                    <a
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--tw-blue)] hover:underline font-medium line-clamp-1"
                    >
                      {cite.title || cite.url}
                    </a>
                    <p className="text-[var(--tw-muted)] mt-0.5">
                      Accessed {cite.accessed}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
