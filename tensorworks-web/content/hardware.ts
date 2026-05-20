export interface HardwareConfig {
  slug: string;
  title: string;
  gpu: string;
  cpu: string;
  ram: string;
  storage: string;
  network: string;
  powerDraw: string;
  useCases: string[];
  leadTime: string;
  formFactor?: string;
  notes?: string;
}

export interface HardwareCategory {
  slug: string;
  title: string;
  description: string;
  configurations: HardwareConfig[];
}

export const hardwareCategories: HardwareCategory[] = [
  {
    slug: "training-systems",
    title: "Training Systems",
    description:
      "Multi-GPU servers and clusters for foundation model training. Configured for NVLink bandwidth, high-speed storage I/O, and long-run stability.",
    configurations: [
      {
        slug: "h200-8gpu",
        title: "H200 SXM 8-GPU Training Server",
        gpu: "8× NVIDIA H200 SXM (141GB HBM3e each)",
        cpu: "2× Intel Xeon Platinum 8568Y+ (48C/96T each)",
        ram: "2TB DDR5-4800 ECC",
        storage: "8× 7.68TB NVMe U.2 (PCIe Gen5) + 2× 1.92TB OS NVMe",
        network: "8× 400Gb/s InfiniBand NDR · 2× 100GbE OCP",
        powerDraw: "10.2kW peak",
        useCases: ["LLM pre-training", "Fine-tuning at scale", "Distributed RLHF"],
        leadTime: "8–12 weeks",
        formFactor: "8U rackmount",
        notes: "Requires 3-phase power. Cooling specification on request.",
      },
      {
        slug: "h100-8gpu",
        title: "H100 SXM 8-GPU Training Server",
        gpu: "8× NVIDIA H100 SXM (80GB HBM2e each)",
        cpu: "2× Intel Xeon Platinum 8480+ (60C/120T each)",
        ram: "2TB DDR5-4800 ECC",
        storage: "8× 3.84TB NVMe U.2 (PCIe Gen4) + 2× 960GB OS NVMe",
        network: "8× 400Gb/s InfiniBand HDR · 2× 100GbE OCP",
        powerDraw: "9.6kW peak",
        useCases: ["LLM pre-training", "Fine-tuning", "Research HPC"],
        leadTime: "6–10 weeks",
        formFactor: "8U rackmount",
      },
      {
        slug: "h100-cluster-4node",
        title: "H100 4-Node Training Cluster",
        gpu: "32× NVIDIA H100 SXM (80GB HBM2e)",
        cpu: "8× Intel Xeon Platinum 8480+ (60C/120T)",
        ram: "8TB DDR5-4800 ECC",
        storage: "Parallel NFS head node (1PB usable) + per-node NVMe cache",
        network: "InfiniBand HDR400 fat-tree fabric · 100GbE management",
        powerDraw: "38.4kW peak cluster",
        useCases: ["Foundation model training", "Multi-node distributed jobs", "Research clusters"],
        leadTime: "12–16 weeks",
        formFactor: "Half-rack",
        notes: "Includes rack, PDUs, top-of-rack switches, and cable management.",
      },
    ],
  },
  {
    slug: "inference-servers",
    title: "Inference Servers",
    description:
      "GPU servers optimised for high-throughput, low-latency inference. Sized for KV cache efficiency and concurrent request handling.",
    configurations: [
      {
        slug: "h100-inference-4gpu",
        title: "H100 NVL 4-GPU Inference Server",
        gpu: "4× NVIDIA H100 NVL (94GB HBM2e each)",
        cpu: "2× AMD EPYC 9354P (32C/64T each)",
        ram: "768GB DDR5-4800 ECC",
        storage: "4× 3.84TB NVMe Gen4 + 2× 960GB OS",
        network: "2× 100GbE · 1× IPMI",
        powerDraw: "3.2kW peak",
        useCases: ["Production LLM serving", "RAG backends", "Embedding generation"],
        leadTime: "4–6 weeks",
        formFactor: "2U rackmount",
      },
      {
        slug: "l40s-inference",
        title: "L40S 8-GPU Inference Server",
        gpu: "8× NVIDIA L40S (48GB GDDR6 each)",
        cpu: "2× Intel Xeon Gold 6438M (32C/64T each)",
        ram: "512GB DDR5-4400 ECC",
        storage: "4× 1.92TB NVMe Gen4 + 2× 960GB OS",
        network: "2× 25GbE · 1× IPMI",
        powerDraw: "4.8kW peak",
        useCases: ["High-throughput inference", "Image generation", "Video processing"],
        leadTime: "3–5 weeks",
        formFactor: "4U rackmount",
      },
    ],
  },
  {
    slug: "workstations",
    title: "AI Workstations",
    description:
      "High-performance workstations for researchers and engineers who need local GPU compute without shared cluster constraints.",
    configurations: [
      {
        slug: "rtx6000-workstation",
        title: "RTX 6000 Ada Workstation",
        gpu: "2× NVIDIA RTX 6000 Ada (48GB GDDR6 each)",
        cpu: "Intel Core i9-14900K (24C/32T)",
        ram: "192GB DDR5-5600 ECC",
        storage: "2× 4TB NVMe Gen4 RAID-1 + 8TB SATA SSD",
        network: "2.5GbE · WiFi 6E · Thunderbolt 4",
        powerDraw: "1.2kW peak",
        useCases: ["Model development", "Fine-tuning", "Research experiments"],
        leadTime: "2–3 weeks",
        formFactor: "Tower",
      },
    ],
  },
  {
    slug: "networking",
    title: "Networking",
    description:
      "InfiniBand and Ethernet fabric for multi-node clusters. NVIDIA Quantum and Spectrum switches, Mellanox ConnectX NICs.",
    configurations: [
      {
        slug: "infiniband-hdr-switch",
        title: "QM9700 InfiniBand HDR Switch",
        gpu: "N/A",
        cpu: "N/A",
        ram: "N/A",
        storage: "N/A",
        network: "40× 200Gb/s InfiniBand HDR ports",
        powerDraw: "690W",
        useCases: ["Multi-node GPU cluster fabric", "Storage interconnect"],
        leadTime: "3–6 weeks",
        formFactor: "1U rackmount",
      },
    ],
  },
];
