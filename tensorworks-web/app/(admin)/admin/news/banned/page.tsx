import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddClaimForm } from "./AddClaimForm";

export const metadata = { title: "Banned Claims — TensorWorks Admin" };

export default async function BannedClaimsPage() {
  const claims = await prisma.bannedClaim.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Banned Claims</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">
          {claims.length} banned pattern{claims.length !== 1 ? "s" : ""}
        </p>
      </div>

      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--tw-border)] bg-[var(--tw-bg)]">
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                    Pattern
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                    Reason
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden md:table-cell">
                    Added by
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)] hidden lg:table-cell">
                    Created
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-[var(--tw-muted)]">
                    Delete
                  </th>
                </tr>
              </thead>
              <tbody>
                {claims.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-[var(--tw-muted)]"
                    >
                      No banned claims yet.
                    </td>
                  </tr>
                ) : (
                  claims.map((claim) => (
                    <tr
                      key={claim.id}
                      className="border-b border-[var(--tw-border)] last:border-0 hover:bg-[var(--tw-bg)] transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-sm text-[var(--tw-dark)] break-all">
                        {claim.pattern}
                      </td>
                      <td className="px-4 py-3 text-[var(--tw-mid)] max-w-xs">
                        {claim.reason}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--tw-muted)] hidden md:table-cell">
                        {claim.addedBy}
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--tw-muted)] whitespace-nowrap hidden lg:table-cell">
                        {new Date(claim.createdAt).toLocaleDateString("en-AU")}
                      </td>
                      <td className="px-4 py-3">
                        <form
                          action={`/api/admin/news/banned/${claim.id}`}
                          method="POST"
                        >
                          <input type="hidden" name="_method" value="DELETE" />
                          <button
                            type="submit"
                            className="px-2.5 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add claim form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add banned claim</CardTitle>
        </CardHeader>
        <CardContent>
          <AddClaimForm />
        </CardContent>
      </Card>
    </div>
  );
}
