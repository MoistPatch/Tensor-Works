"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X, Menu } from "lucide-react";
import { LogoHorizontal } from "@/components/brand/LogoHorizontal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/solutions", label: "Solutions" },
  { href: "/hardware", label: "Hardware" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/insights", label: "Insights" },
];

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-[var(--tw-dark)] hover:bg-[var(--tw-bg)] transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-[var(--tw-border)]">
              <LogoHorizontal markSize={28} />
              <button
                className="p-2 rounded-md hover:bg-[var(--tw-bg)] text-[var(--tw-dark)] transition-colors"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center h-11 rounded-md px-3 text-sm font-medium transition-colors",
                    pathname.startsWith(link.href)
                      ? "bg-[var(--tw-blue)] text-white"
                      : "text-[var(--tw-dark)] hover:bg-[var(--tw-bg)]"
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="px-5 pb-8 pt-4 border-t border-[var(--tw-border)]">
              <Button asChild className="w-full" size="lg">
                <Link href="/contact">Request a Quote</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
