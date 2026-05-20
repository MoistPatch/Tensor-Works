import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { LogoHorizontal } from "@/components/brand/LogoHorizontal";
import { LayoutDashboard, FileText, Settings, ScrollText, LogOut, PenSquare, Rss, Mail, Users } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/rfqs", label: "RFQs", icon: FileText },
  { href: "/admin/content", label: "Content", icon: PenSquare },
  { href: "/admin/news", label: "News", icon: Rss },
  { href: "/admin/campaigns", label: "Campaigns", icon: Mail },
  { href: "/admin/subscribers", label: "Subscribers", icon: Users },
  { href: "/admin/audit", label: "Audit Log", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/admin/auth/login");
  }

  return (
    <div className="flex h-screen bg-[var(--tw-bg)]">
      <aside className="w-60 flex-shrink-0 bg-[var(--tw-dark)] flex flex-col">
        <div className="px-5 py-4 border-b border-gray-700">
          <LogoHorizontal markSize={28} inverted />
          <p className="text-xs text-gray-500 mt-1">Admin panel</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-700">
          <p className="px-3 text-xs text-gray-500 mb-2 truncate">{user}</p>
          <form action="/api/admin/auth" method="DELETE">
            <button
              type="submit"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
