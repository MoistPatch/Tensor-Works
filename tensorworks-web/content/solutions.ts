export interface Solution {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  capabilities: string[];
  recommendedHardware: string[];
  useCases: string[];
}

export const solutions: Solution[] = [
  {
    slug: "llm-training",
    title: "LLM Training",
    subtitle: "Multi-GPU systems for foundation model training and fine-tuning",
    description:
      "Training large language models requires deterministic throughput, high-bandwidth GPU interconnects, and storage that can sustain the data pipeline. We configure systems for Australian research institutions and enterprises that need to run these workloads on-premise — not in a hyperscaler.",
    capabilities: [
      "NVLink and InfiniBand fabric configuration for multi-node training",
      "NVIDIA H100, H200, and B200 GPU clusters",
      "Parallel file system integration (GPFS, Lustre, BeeGFS)",
      "DCGM-based health monitoring and alerting",
      "Custom BIOS and firmware tuning for training stability",
    ],
    recommendedHardware: ["h200-8gpu", "h100-cluster-4node"],
    useCases: [
      "Foundation model pre-training",
      "Domain-specific fine-tuning (medical, legal, government)",
      "RLHF pipelines",
      "Multimodal model training",
    ],
  },
  {
    slug: "inference",
    title: "Inference at Scale",
    subtitle: "Low-latency serving infrastructure for production AI deployments",
    description:
      "Inference workloads have different constraints to training: latency SLAs, concurrent request handling, and cost-per-token efficiency. We design systems that match your throughput requirements without over-provisioning GPU memory you will not use.",
    capabilities: [
      "vLLM and TensorRT-LLM optimised configurations",
      "KV cache sizing for your context window requirements",
      "Load balancing across GPU nodes",
      "Disaggregated prefill-decode architectures",
      "Integration with your existing API gateway",
    ],
    recommendedHardware: ["l40s-inference", "h100-inference-4gpu"],
    useCases: [
      "Production LLM API serving",
      "RAG pipeline backends",
      "Document processing at scale",
      "Real-time classification and embedding",
    ],
  },
  {
    slug: "research-hpc",
    title: "Research and HPC",
    subtitle: "Compute infrastructure for universities and research institutions",
    description:
      "Australian research institutions face unique procurement constraints: ITAR compliance, data sovereignty requirements, and the need to demonstrate local economic benefit. We have experience navigating these requirements and supplying systems that satisfy both technical and compliance needs.",
    capabilities: [
      "Sovereign supply chain documentation",
      "ITAR-compliant sourcing where required",
      "Integration with university HPC schedulers (SLURM, PBS)",
      "Research data management storage",
      "Multi-project allocation and GPU partitioning",
    ],
    recommendedHardware: ["h100-cluster-4node", "a100-research"],
    useCases: [
      "Bioinformatics and genomics workloads",
      "Climate and earth systems modelling",
      "Computational materials science",
      "Natural language processing research",
    ],
  },
  {
    slug: "defence",
    title: "Defence and Classified Compute",
    subtitle: "Sovereign AI compute for sensitive and classified environments",
    description:
      "Defence and intelligence applications require hardware that has been sourced, configured, and delivered through a documented Australian supply chain. We supply systems designed for secure environments — air-gapped deployments, ruggedised configurations, and full provenance documentation.",
    capabilities: [
      "Australian supply chain provenance documentation",
      "Air-gapped deployment configurations",
      "Hardware security module integration",
      "Ruggedised chassis options for field deployment",
      "End-to-end delivery and installation",
    ],
    recommendedHardware: ["h100-secure", "l40s-ruggedised"],
    useCases: [
      "On-premise intelligence analysis",
      "Secure document processing",
      "Autonomous systems development",
      "Geospatial AI",
    ],
  },
  {
    slug: "edge",
    title: "Edge AI",
    subtitle: "Compact, power-efficient inference at the point of decision",
    description:
      "Some workloads cannot go to a data centre — latency requirements, connectivity constraints, or data sovereignty requirements mean the compute must sit alongside the sensor or actuator. We build edge AI appliances for industrial, remote, and secure environments.",
    capabilities: [
      "NVIDIA Jetson and Orin-based embedded systems",
      "Ruggedised enclosures rated for industrial environments",
      "LTE, WiFi 6E, and satellite connectivity options",
      "Remote management via secure out-of-band interfaces",
      "Custom enclosure design for specific deployment contexts",
    ],
    recommendedHardware: ["orin-agx", "edge-inference-1u"],
    useCases: [
      "Industrial computer vision",
      "Remote monitoring and anomaly detection",
      "Autonomous vehicle perception",
      "Smart infrastructure",
    ],
  },
];
