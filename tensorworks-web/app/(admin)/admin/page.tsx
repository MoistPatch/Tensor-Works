import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import Link from "next/link";
import { FileText, Clock, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin Dashboard — TensorWorks" };

export default async function AdminDashboardPage() {
  const [totalRFQs, newRFQs, recentRFQs] = await Promise.all([
    prisma.rFQSubmission.count(),
    prisma.rFQSubmission.count({ where: { status: "new" } }),
    prisma.rFQSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        companyName: true,
        contactName: true,
        status: true,
        createdAt: true,
        budgetBracket: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Dashboard</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">Overview of RFQ submissions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--tw-muted)]">Total RFQs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--tw-dark)]">{totalRFQs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--tw-muted)]">New / unreviewed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--tw-blue)]">{newRFQs}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-[var(--tw-muted)]">In progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--tw-green)]">
              {totalRFQs - newRFQs}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent submissions</CardTitle>
          <Link
            href="/admin/rfqs"
            className="text-sm text-[var(--tw-blue)] hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {recentRFQs.length === 0 ? (
            <p className="text-sm text-[var(--tw-muted)] py-4 text-center">No submissions yet.</p>
          ) : (
            <div className="space-y-3">
              {recentRFQs.map((rfq: { id: string; companyName: string; contactName: string; status: string; createdAt: Date; budgetBracket: string }) => (
                <Link
                  key={rfq.id}
                  href={`/admin/rfqs/${rfq.id}`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[var(--tw-bg)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${rfq.status === "new" ? "bg-[var(--tw-blue)]" : "bg-[var(--tw-green)]"}`} />
                    <div>
                      <p className="text-sm font-medium text-[var(--tw-dark)]">{rfq.companyName}</p>
                      <p className="text-xs text-[var(--tw-muted)]">{rfq.contactName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--tw-muted)]">
                      {new Date(rfq.createdAt).toLocaleDateString("en-AU")}
                    </p>
                    <p className="text-xs text-[var(--tw-mid)]">{rfq.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
