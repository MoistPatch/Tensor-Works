export interface Service {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  engagementModel: string;
  deliverables: string[];
  typicalTimeline: string;
}

export const services: Service[] = [
  {
    slug: "oem-odm",
    title: "OEM / ODM Manufacturing",
    subtitle: "Custom-built systems under your brand or ours",
    description:
      "For technology companies and ISVs that need compute hardware under their own brand. We handle mechanical design, component sourcing, assembly, burn-in testing, validation, and production-run fulfilment. Full NDA protection and IP ownership clarity from the outset.",
    engagementModel:
      "Initial scoping call to understand your design requirements and volumes. We provide a Statement of Work covering design specifications, unit economics, MOQ, and production schedule. NDA executed before any confidential disclosure.",
    deliverables: [
      "Hardware design specification document",
      "Bill of materials with approved suppliers",
      "Prototype unit for validation (2–4 weeks)",
      "RCM, CE, and FCC compliance documentation",
      "White-label firmware and BIOS configuration",
      "Production-run fulfilment from 5 units",
    ],
    typicalTimeline: "Prototype in 6–8 weeks. Production run 10–16 weeks depending on volume.",
  },
  {
    slug: "system-integration",
    title: "System Integration",
    subtitle: "Configured, tested, and documented before it leaves our facility",
    description:
      "Rack-and-stack is not enough. We configure operating systems, install drivers, validate GPU communication, benchmark against specification, and document the system before delivery. You receive a working system, not a pile of components.",
    engagementModel:
      "Systems are ordered against a configuration specification. After assembly, each system goes through a burn-in and benchmark process. You receive a test report alongside the equipment.",
    deliverables: [
      "Configuration specification sign-off",
      "BIOS, firmware, and driver configuration",
      "GPU communication validation (NCCL tests for multi-GPU)",
      "Burn-in and stability testing (72-hour minimum)",
      "Benchmark report against agreed specifications",
      "Delivery to your facility with installation support option",
    ],
    typicalTimeline: "2–6 weeks from order confirmation depending on configuration complexity.",
  },
  {
    slug: "support-contracts",
    title: "Support Contracts",
    subtitle: "Hardware support backed by people who built the system",
    description:
      "We offer support contracts for systems we supply. When something fails, you deal with the team that configured the system — not a generic OEM support queue.",
    engagementModel:
      "Annual contracts with defined SLA tiers. Remote diagnosis first, on-site response where required. Spare parts held for contracted customers.",
    deliverables: [
      "Named account manager and technical contact",
      "Remote diagnosis within 4 business hours (Business tier)",
      "Remote diagnosis within 1 business hour (Enterprise tier)",
      "On-site response within 24 or 48 hours depending on tier",
      "Spare GPU, NIC, and drive stock held for contracted systems",
      "Annual hardware health review",
    ],
    typicalTimeline: "Contracts run 12 months. Multi-year discounts available.",
  },
  {
    slug: "sovereign-procurement",
    title: "Sovereign Procurement Consulting",
    subtitle: "Navigating Australian procurement requirements for AI hardware",
    description:
      "Australian government, defence, and research procurement processes have specific requirements around supply chain documentation, security clearances, and local content. We assist organisations in structuring procurement approaches that satisfy these requirements.",
    engagementModel:
      "Typically engaged early in a procurement cycle to advise on specification writing, vendor qualification, and supply chain documentation requirements. Can participate in procurement advisory panels where appropriate.",
    deliverables: [
      "Supply chain provenance documentation for tendered hardware",
      "Technical specification review and input",
      "ITAR compliance assessment for relevant components",
      "Australian content and industry participation documentation",
      "Security configuration recommendations for sensitive deployments",
    ],
    typicalTimeline: "Consulting engagements scoped per project.",
  },
];
