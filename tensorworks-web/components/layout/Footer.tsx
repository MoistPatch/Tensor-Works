import Link from "next/link";
import { LogoVertical } from "@/components/brand/LogoVertical";

const currentYear = new Date().getFullYear();

const footerLinks = {
  Solutions: [
    { href: "/solutions/llm-training", label: "LLM Training" },
    { href: "/solutions/inference", label: "Inference at Scale" },
    { href: "/solutions/research-hpc", label: "Research and HPC" },
    { href: "/solutions/defence", label: "Defence Compute" },
    { href: "/solutions/edge", label: "Edge AI" },
  ],
  Hardware: [
    { href: "/hardware#training-systems", label: "Training Systems" },
    { href: "/hardware#inference-servers", label: "Inference Servers" },
    { href: "/hardware#workstations", label: "AI Workstations" },
    { href: "/hardware#networking", label: "Networking" },
  ],
  Company: [
    { href: "/about", label: "About" },
    { href: "/services", label: "Services" },
    { href: "/insights", label: "Insights" },
    { href: "/contact", label: "Contact" },
    { href: "/privacy", label: "Privacy Policy" },
    { href: "/terms", label: "Terms of Service" },
  ],
};

export function Footer() {
  return (
    <footer className="bg-[var(--tw-dark)] text-white mt-auto">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="py-14 grid grid-cols-1 gap-10 md:grid-cols-4">
          <div className="md:col-span-1">
            <LogoVertical markSize={40} inverted />
            <p className="mt-4 text-sm text-gray-400 leading-relaxed max-w-xs">
              Australian AI compute infrastructure. Designed, integrated, and
              supported by a local team.
            </p>
            <p className="mt-4 text-xs text-gray-500">ABN: 84 544 119 830</p>
          </div>

          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                {heading}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-gray-700 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <p>© {currentYear} TensorWorks Pty Ltd. All rights reserved.</p>
          <p>Designed and built in Australia.</p>
        </div>
      </div>
    </footer>
  );
}
