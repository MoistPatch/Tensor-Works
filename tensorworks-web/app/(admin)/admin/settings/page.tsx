import { getSessionUser } from "@/lib/auth";
import { env } from "@/lib/env";

export const metadata = { title: "Settings — TensorWorks Admin" };

export default async function SettingsPage() {
  const user = await getSessionUser();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[var(--tw-dark)]">Settings</h1>
        <p className="text-sm text-[var(--tw-muted)] mt-1">Read-only environment configuration</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--tw-border)] divide-y divide-[var(--tw-border)]">
        {[
          { label: "Signed in as", value: user ?? "—" },
          { label: "Admin emails", value: env.ADMIN_EMAILS },
          { label: "From email", value: env.FROM_EMAIL },
          { label: "Notification email", value: env.NOTIFICATION_EMAIL },
          { label: "Site URL", value: env.NEXT_PUBLIC_SITE_URL },
          { label: "HubSpot portal ID", value: env.HUBSPOT_PORTAL_ID },
        ].map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm font-medium text-[var(--tw-dark)]">{row.label}</span>
            <span className="text-sm text-[var(--tw-muted)] font-mono">{row.value}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--tw-muted)]">
        To change these values, update the environment variables and redeploy.
      </p>
    </div>
  );
}
