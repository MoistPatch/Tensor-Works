"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const TYPE_LABELS: Record<string, string> = {
  weekly_digest_email: "Weekly Digest",
  post_announcement: "Post Announcement",
  cold_intro: "Cold Intro",
  welcome_1: "Welcome 1",
  welcome_2: "Welcome 2",
  welcome_3: "Welcome 3",
  reengagement: "Re-engagement",
  manual_broadcast: "Manual Broadcast",
};

function TypeBadge({ type }: { type: string }) {
  if (type === "weekly_digest_email") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-blue)] text-white">
        {TYPE_LABELS[type] ?? type}
      </span>
    );
  }
  if (type === "post_announcement") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-[var(--tw-green)] text-white">
        {TYPE_LABELS[type] ?? type}
      </span>
    );
  }
  if (type === "cold_intro") {
    return (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
        {TYPE_LABELS[type] ?? type}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-200 text-[var(--tw-dark)]">
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    draft: "bg-gray-100 text-[var(--tw-muted)]",
    in_review: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    scheduled: "bg-[var(--tw-blue)] text-white",
    sent: "bg-[var(--tw-dark)] text-white",
    failed: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    draft: "Draft",
    in_review: "In Review",
    approved: "Approved",
    scheduled: "Scheduled",
    sent: "Sent",
    failed: "Failed",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[status] ?? "bg-gray-100 text-[var(--tw-muted)]"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

interface Campaign {
  id: string;
  blogPostId: string | null;
  type: string;
  segmentTag: string;
  subjectLine: string;
  previewText: string;
  bodyMjml: string;
  bodyHtml: string;
  bodyText: string;
  status: string;
  scheduledFor: Date | null;
  sentAt: Date | null;
  recipientCount: number | null;
  generatedBy: string | null;
  reviewedBy: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  mailchimpCampaignId: string | null;
}

interface Props {
  campaign: Campaign;
}

type Tab = "preview" | "mjml";

function toDatetimeLocal(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  // Format as YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CampaignEditor({ campaign }: Props) {
  const router = useRouter();

  const [subject, setSubject] = useState(campaign.subjectLine);
  const [previewText, setPreviewText] = useState(campaign.previewText);
  const [bodyMjml, setBodyMjml] = useState(campaign.bodyMjml);
  const [activeTab, setActiveTab] = useState<Tab>("preview");
  const [scheduledFor, setScheduledFor] = useState(toDatetimeLocal(campaign.scheduledFor));
  const [status, setStatus] = useState(campaign.status);

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

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectLine: subject, previewText, bodyMjml }),
      });
      if (!res.ok) throw new Error("Request failed");
      showMsg("Changes saved.");
    } catch {
      showMsg("Failed to save changes.", true);
    } finally {
      setSaving(false);
    }
  }, [campaign.id, subject, previewText, bodyMjml]);

  const handleApproveAndSchedule = useCallback(async () => {
    if (!scheduledFor) {
      showMsg("Please set a scheduled send time first.", true);
      return;
    }
    setActionLoading("approveSchedule");
    try {
      const approveRes = await fetch(`/api/admin/campaigns/${campaign.id}/approve`, {
        method: "POST",
      });
      if (!approveRes.ok) throw new Error("Approve failed");

      const scheduleRes = await fetch(`/api/admin/campaigns/${campaign.id}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledFor }),
      });
      if (!scheduleRes.ok) throw new Error("Schedule failed");

      setStatus("scheduled");
      showMsg("Campaign approved and scheduled.");
      router.refresh();
    } catch (err: unknown) {
      showMsg(err instanceof Error ? err.message : "Failed to approve and schedule.", true);
    } finally {
      setActionLoading(null);
    }
  }, [campaign.id, scheduledFor, router]);

  const handleSendNow = useCallback(async () => {
    if (!confirm("Send this campaign now? This cannot be undone.")) return;
    setActionLoading("send");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/send`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("sent");
      showMsg("Campaign sent.");
      router.refresh();
    } catch {
      showMsg("Failed to send campaign.", true);
    } finally {
      setActionLoading(null);
    }
  }, [campaign.id, router]);

  const handleTestEmail = useCallback(async () => {
    setActionLoading("test");
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/test`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Request failed");
      showMsg("Test email sent to your address.");
    } catch {
      showMsg("Failed to send test email.", true);
    } finally {
      setActionLoading(null);
    }
  }, [campaign.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/campaigns"
            className="text-sm text-[var(--tw-muted)] hover:text-[var(--tw-dark)] transition-colors"
          >
            ← Campaigns
          </Link>
          <span className="text-[var(--tw-border)]">/</span>
          <span className="text-sm text-[var(--tw-dark)] font-medium truncate max-w-xs">
            {subject}
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
        {/* Left pane */}
        <div className="space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-[var(--tw-muted)] mb-1">
              Subject line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-[var(--tw-border)] px-3 py-2 text-base font-semibold text-[var(--tw-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] bg-white"
            />
          </div>

          {/* Preview text */}
          <div>
            <label className="block text-xs font-medium text-[var(--tw-muted)] mb-1">
              Preview text
            </label>
            <input
              type="text"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              className="w-full rounded-lg border border-[var(--tw-border)] px-3 py-2 text-sm text-[var(--tw-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] bg-white"
            />
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-[var(--tw-border)]">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "preview"
                  ? "border-[var(--tw-blue)] text-[var(--tw-blue)]"
                  : "border-transparent text-[var(--tw-muted)] hover:text-[var(--tw-dark)]"
              }`}
            >
              Preview HTML
            </button>
            <button
              onClick={() => setActiveTab("mjml")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "mjml"
                  ? "border-[var(--tw-blue)] text-[var(--tw-blue)]"
                  : "border-transparent text-[var(--tw-muted)] hover:text-[var(--tw-dark)]"
              }`}
            >
              Edit MJML
            </button>
          </div>

          {/* Tab content */}
          {activeTab === "preview" ? (
            <div className="rounded-xl border border-[var(--tw-border)] overflow-hidden bg-white">
              <iframe
                srcDoc={campaign.bodyHtml}
                className="w-full"
                style={{ height: "600px", border: "none" }}
                title="Email preview"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={bodyMjml}
                onChange={(e) => setBodyMjml(e.target.value)}
                rows={30}
                className="w-full rounded-lg border border-[var(--tw-border)] px-3 py-2 text-xs text-[var(--tw-dark)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] bg-white resize-y"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[var(--tw-blue)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  onClick={() => setBodyMjml(campaign.bodyMjml)}
                  className="px-4 py-2 rounded-lg border border-[var(--tw-border)] text-sm text-[var(--tw-dark)] hover:bg-[var(--tw-bg)] transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-[var(--tw-border)] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[var(--tw-dark)]">Send</h3>

            {/* Scheduled for */}
            <div>
              <label className="block text-xs font-medium text-[var(--tw-muted)] mb-1">
                Scheduled for
              </label>
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="w-full rounded-lg border border-[var(--tw-border)] px-3 py-2 text-sm text-[var(--tw-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--tw-blue)] bg-white"
              />
            </div>

            <button
              onClick={handleTestEmail}
              disabled={actionLoading !== null}
              className="w-full px-4 py-2 rounded-lg border border-[var(--tw-border)] text-sm text-[var(--tw-dark)] hover:bg-[var(--tw-bg)] transition-colors disabled:opacity-50"
            >
              {actionLoading === "test" ? "Sending…" : "Send test email"}
            </button>

            {status !== "sent" && status !== "scheduled" && (
              <button
                onClick={handleApproveAndSchedule}
                disabled={actionLoading !== null}
                className="w-full px-4 py-2 rounded-lg bg-[var(--tw-green)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {actionLoading === "approveSchedule" ? "Scheduling…" : "Approve + Schedule"}
              </button>
            )}

            {status === "approved" && (
              <button
                onClick={handleSendNow}
                disabled={actionLoading !== null}
                className="w-full px-4 py-2 rounded-lg bg-[var(--tw-dark)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {actionLoading === "send" ? "Sending…" : "Send now"}
              </button>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-white rounded-xl border border-[var(--tw-border)] p-4 space-y-3 text-sm">
            <h3 className="text-sm font-semibold text-[var(--tw-dark)]">Details</h3>

            <div className="flex items-center justify-between">
              <span className="text-[var(--tw-muted)]">Type</span>
              <TypeBadge type={campaign.type} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--tw-muted)]">Segment</span>
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-[var(--tw-mid)]">
                {campaign.segmentTag}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--tw-muted)]">Status</span>
              <StatusBadge status={status} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--tw-muted)]">Recipient estimate</span>
              <span className="text-[var(--tw-dark)] tabular-nums">
                {campaign.recipientCount != null
                  ? campaign.recipientCount.toLocaleString("en-AU")
                  : "—"}
              </span>
            </div>

            {campaign.blogPostId && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--tw-muted)]">Blog post</span>
                <Link
                  href={`/admin/content/${campaign.blogPostId}`}
                  className="text-[var(--tw-blue)] hover:underline text-xs"
                >
                  → View post
                </Link>
              </div>
            )}

            {campaign.generatedBy && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--tw-muted)]">Generated by</span>
                <span className="text-[var(--tw-dark)] text-xs font-mono">
                  {campaign.generatedBy}
                </span>
              </div>
            )}

            {campaign.approvedAt && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--tw-muted)]">Approved at</span>
                <span className="text-[var(--tw-dark)] text-xs">
                  {new Date(campaign.approvedAt).toLocaleDateString("en-AU")}
                </span>
              </div>
            )}

            {campaign.reviewedBy && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--tw-muted)]">Approved by</span>
                <span className="text-[var(--tw-dark)] text-xs truncate max-w-[140px]">
                  {campaign.reviewedBy}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[var(--tw-muted)]">Created</span>
              <span className="text-[var(--tw-dark)] text-xs">
                {new Date(campaign.createdAt).toLocaleDateString("en-AU")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
