import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { budgetBracketLabels, organisationTypeLabels } from "@/lib/validations/rfq";

export const metadata = { title: "RFQs — TensorWorks Admin" };

const STATUS_COLOURS: Record<string, "default" | "accent" | "secondary" | "outline"> = {
  new: "default",
  reviewing: "accent",
  proposal_sent: "secondary",
  closed: "outline",
};

interface Props {
  searchParams: Promise<{ page?: string; status?: string }>;
}

export default async function RFQsPage({ searchParams }: Props) {
  const { page = "1", status } = await searchParams;
  const pageNum = Math.max(1, parseInt(page));
  const pageSize = 25;

  const where = status ? { status } : undefined;

  const [submissions, total] = await Promise.all([
    prisma.rFQSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageNum - 1) * pageSize,
      take: pageSize,
    }),
    prisma.rFQSubmission.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">RFQ Submissions</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">{total} total</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--tw-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Company</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">Contact</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">Type</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden xl:table-cell">Budget</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Status</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">Date</th>
            </tr>
          </thead>
          <tbody>
            {submissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-[var(--tw-muted)]">
                  No submissions found.
                </td>
              </tr>
            ) : (
              submissions.map((rfq: { id: string; companyName: string; contactName: string; organisationType: string; budgetBracket: string; status: string; createdAt: Date }) => (
                <tr
                  key={rfq.id}
                  className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)] transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/rfqs/${rfq.id}`}
                      className="font-medium text-[var(--tw-dark)] hover:text-[var(--tw-blue)]"
                    >
                      {rfq.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[var(--tw-mid)] hidden md:table-cell">
                    {rfq.contactName}
                  </td>
                  <td className="px-4 py-3 text-[var(--tw-mid)] hidden lg:table-cell">
                    {organisationTypeLabels[rfq.organisationType] ?? rfq.organisationType}
                  </td>
                  <td className="px-4 py-3 text-[var(--tw-mid)] hidden xl:table-cell">
                    {budgetBracketLabels[rfq.budgetBracket] ?? rfq.budgetBracket}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_COLOURS[rfq.status] ?? "outline"} className="text-xs">
                      {rfq.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--tw-muted)] whitespace-nowrap text-xs">
                    {new Date(rfq.createdAt).toLocaleDateString("en-AU")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2 justify-center">
          {pageNum > 1 && (
            <Link
              href={`/admin/rfqs?page=${pageNum - 1}${status ? `&status=${status}` : ""}`}
              className="px-3 py-1.5 rounded border border-[var(--tw-border)] text-sm hover:bg-[var(--tw-bg)]"
            >
              Previous
            </Link>
          )}
          <span className="text-sm text-[var(--tw-muted)]">
            Page {pageNum} of {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link
              href={`/admin/rfqs?page=${pageNum + 1}${status ? `&status=${status}` : ""}`}
              className="px-3 py-1.5 rounded border border-[var(--tw-border)] text-sm hover:bg-[var(--tw-bg)]"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
