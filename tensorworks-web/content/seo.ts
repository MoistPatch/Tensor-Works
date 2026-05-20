export interface PageSEO {
  title: string;
  description: string;
  canonical?: string;
  noIndex?: boolean;
}

export const siteSEO = {
  siteName: "TensorWorks",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://tensorworks.com.au",
  defaultDescription:
    "Australian-built AI compute systems. TensorWorks designs, integrates, and supports GPU infrastructure for research institutions, enterprises, and government.",
  twitterHandle: "@tensorworks",
};

export const pageSEO: Record<string, PageSEO> = {
  home: {
    title: "TensorWorks — Australian AI Compute Infrastructure",
    description:
      "GPU servers, training clusters, and inference systems designed, integrated, and supported by an Australian team. No hyperscaler dependency.",
  },
  solutions: {
    title: "Solutions — TensorWorks",
    description:
      "AI infrastructure solutions for LLM training, production inference, university HPC, defence, and edge deployment.",
  },
  "solutions/llm-training": {
    title: "LLM Training Infrastructure — TensorWorks",
    description:
      "Multi-GPU training clusters for foundation model pre-training and fine-tuning. NVIDIA H100, H200, and B200 configured for Australian research and enterprise.",
  },
  "solutions/inference": {
    title: "Inference at Scale — TensorWorks",
    description:
      "Low-latency GPU inference infrastructure for production AI deployments. vLLM and TensorRT-LLM optimised configurations.",
  },
  "solutions/research-hpc": {
    title: "Research and HPC — TensorWorks",
    description:
      "Compute infrastructure for Australian universities and research institutions. Sovereign supply chain, ITAR-compliant sourcing, SLURM integration.",
  },
  "solutions/defence": {
    title: "Defence and Classified Compute — TensorWorks",
    description:
      "Sovereign AI compute for sensitive environments. Air-gapped configurations, provenance documentation, and Australian supply chain.",
  },
  "solutions/edge": {
    title: "Edge AI — TensorWorks",
    description:
      "Compact, ruggedised inference appliances for industrial, remote, and secure environments where the compute must stay on-site.",
  },
  hardware: {
    title: "Hardware — TensorWorks",
    description:
      "GPU training servers, inference systems, AI workstations, and cluster networking. Configured, tested, and documented before delivery.",
  },
  services: {
    title: "Services — TensorWorks",
    description:
      "OEM/ODM manufacturing, system integration, support contracts, and sovereign procurement consulting for Australian AI infrastructure.",
  },
  about: {
    title: "About TensorWorks",
    description:
      "TensorWorks is an Australian company that designs, integrates, and supports GPU-based compute systems for AI workloads.",
  },
  contact: {
    title: "Contact — TensorWorks",
    description:
      "Get in touch with TensorWorks to discuss your AI infrastructure requirements. Submit an RFQ or speak with our engineering team.",
  },
  insights: {
    title: "Insights — TensorWorks",
    description:
      "Technical articles and guidance on AI compute infrastructure from the TensorWorks engineering team.",
  },
  privacy: {
    title: "Privacy Policy — TensorWorks",
    description: "TensorWorks privacy policy.",
    noIndex: true,
  },
  terms: {
    title: "Terms of Service — TensorWorks",
    description: "TensorWorks terms of service.",
    noIndex: true,
  },
  "thank-you": {
    title: "Request Received — TensorWorks",
    description: "Your RFQ has been received. We will be in touch shortly.",
    noIndex: true,
  },
};
