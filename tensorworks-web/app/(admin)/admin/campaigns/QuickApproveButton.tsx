"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  campaignId: string;
}

export function QuickApproveButton({ campaignId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Request failed");
      router.refresh();
    } catch {
      alert("Failed to approve campaign.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleApprove}
      disabled={loading}
      className="text-xs px-2.5 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors disabled:opacity-50"
    >
      {loading ? "Approving…" : "Quick approve"}
    </button>
  );
}
