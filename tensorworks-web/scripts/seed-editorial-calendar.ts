import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const topics = [
  // ── GPU Architecture ───────────────────────────────────────────────
  {
    topic: "NVIDIA Blackwell GB200 NVL72 architecture deep dive",
    description: "Detailed technical analysis of the GB200 NVL72 rack-scale GPU system: NVLink 5 topology, HBM3e memory subsystem, Blackwell Transformer Engine improvements, and implications for large language model training throughput compared to Hopper.",
    category: "GPU Architecture",
    tier: "deep-analysis",
    priority: 90,
  },
  {
    topic: "AMD MI300X vs NVIDIA H100: memory bandwidth in practice",
    description: "Comparative analysis of AMD Instinct MI300X (192GB HBM3) and NVIDIA H100 SXM (80GB HBM3e) memory bandwidth for inference workloads: kernel utilisation, roofline analysis, and use cases where each architecture excels.",
    category: "GPU Architecture",
    tier: "deep-analysis",
    priority: 85,
  },
  {
    topic: "Understanding GPU memory hierarchy: HBM, GDDR, and what comes next",
    description: "Technical explainer on GPU memory types from GDDR6 through HBM3e: bandwidth, capacity, latency, cost per GB, and how emerging technologies like LPDDR5X and CXL-attached memory will change AI compute system design.",
    category: "GPU Architecture",
    tier: "weekly-digest",
    priority: 75,
  },
  {
    topic: "Multi-instance GPU (MIG) partitioning for inference serving",
    description: "How NVIDIA MIG works on H100/A100: partition profiles, isolation guarantees, scheduling behaviour, and practical guidance for organisations running multiple inference workloads on a shared GPU cluster.",
    category: "GPU Architecture",
    tier: "weekly-digest",
    priority: 70,
  },

  // ── AI Infrastructure ──────────────────────────────────────────────
  {
    topic: "InfiniBand HDR vs NDR: choosing fabric for AI training clusters",
    description: "Technical comparison of InfiniBand HDR (200Gb/s) and NDR (400Gb/s) for AI training interconnects: latency characteristics, fat-tree topology design, SHARP in-network computing, and total system cost analysis for clusters from 8 to 512 GPUs.",
    category: "AI Infrastructure",
    tier: "deep-analysis",
    priority: 88,
  },
  {
    topic: "RoCEv2 as InfiniBand alternative: when it works and when it doesn't",
    description: "Honest assessment of RDMA over Converged Ethernet v2 for AI workloads: performance relative to InfiniBand, congestion control requirements, operational complexity, and the scenarios where RoCEv2 is a credible cost reduction.",
    category: "AI Infrastructure",
    tier: "deep-analysis",
    priority: 80,
  },
  {
    topic: "Designing storage for AI training: NVMe, WEKA, GPFS, and Lustre",
    description: "Storage architecture options for feeding GPU clusters during training: local NVMe vs parallel filesystems (WEKA, IBM Spectrum Scale, Lustre), throughput requirements per GPU, checkpoint storage patterns, and sizing guidance.",
    category: "AI Infrastructure",
    tier: "deep-analysis",
    priority: 78,
  },
  {
    topic: "Power and cooling in AI data centres: kW per rack trends",
    description: "How GPU rack density has evolved from 10kW to 120kW per rack and what this means for data centre design: liquid cooling options (rear-door, direct liquid, immersion), facility requirements, and power supply chain considerations for Australian buyers.",
    category: "AI Infrastructure",
    tier: "weekly-digest",
    priority: 72,
  },
  {
    topic: "Kubernetes for AI: MIG device plugins, GPU operator, and scheduling",
    description: "Practical guide to running GPU workloads on Kubernetes: NVIDIA GPU Operator, MIG device plugin, Volcano and Yunikorn schedulers for gang scheduling, and monitoring with DCGM.",
    category: "AI Infrastructure",
    tier: "weekly-digest",
    priority: 68,
  },
  {
    topic: "MLOps tooling landscape 2025: MLflow, Kubeflow, W&B, and Vertex",
    description: "Comparison of MLOps platforms for experiment tracking, model registry, and pipeline orchestration: open-source options vs managed services, and guidance for on-premises AI infrastructure deployments.",
    category: "AI Infrastructure",
    tier: "weekly-digest",
    priority: 65,
  },

  // ── Procurement ────────────────────────────────────────────────────
  {
    topic: "Sovereign AI infrastructure procurement: the Australian context",
    description: "Analysis of what 'sovereign AI compute' means in practice for Australian government and defence customers: data sovereignty requirements, ITAR considerations, approved supplier lists, and how to structure procurement to meet ASD Essential Eight and ISM controls.",
    category: "Procurement",
    tier: "deep-analysis",
    priority: 92,
  },
  {
    topic: "Leasing vs purchasing GPU infrastructure: a 3-year TCO analysis",
    description: "Total cost of ownership comparison for on-premises GPU clusters vs cloud GPU instances over a 3-year horizon: capital expenditure, operational costs, utilisation assumptions, and break-even analysis for typical research and enterprise AI workloads.",
    category: "Procurement",
    tier: "deep-analysis",
    priority: 82,
  },
  {
    topic: "How to write a GPU cluster RFQ: specifications that matter",
    description: "Practical guide for procurement officers and IT teams on specifying GPU compute infrastructure: which technical specifications are meaningful, common errors in RFQs, how to compare quotes from different vendors, and questions to ask about lead times and support.",
    category: "Procurement",
    tier: "weekly-digest",
    priority: 76,
  },
  {
    topic: "Australian university AI research infrastructure spending 2024-25",
    description: "Overview of publicly announced AI compute investments at Australian universities and research institutions: ARC-funded projects, ARDC investment, and the emerging picture of Australia's academic AI infrastructure.",
    category: "Procurement",
    tier: "weekly-digest",
    priority: 71,
  },

  // ── Industry Analysis ──────────────────────────────────────────────
  {
    topic: "The GPU supply chain in 2025: allocation, lead times, and alternatives",
    description: "Current state of GPU availability: NVIDIA H100/H200/B200 allocation dynamics, AMD MI300X availability, Chinese export restrictions and their impact on global supply, and what buyers can realistically expect on lead times.",
    category: "Industry Analysis",
    tier: "deep-analysis",
    priority: 86,
  },
  {
    topic: "Custom silicon for AI: what TPUs, Trainium, and Gaudi mean for GPU buyers",
    description: "Analysis of non-GPU AI accelerators from Google (TPU v5), AWS (Trainium 2), Intel (Gaudi 3), and startups: performance characteristics, ecosystem maturity, and whether they represent a credible alternative to NVIDIA for specific workloads.",
    category: "Industry Analysis",
    tier: "deep-analysis",
    priority: 79,
  },
  {
    topic: "Open-source LLM deployment on-premises: Llama, Mistral, and quantisation",
    description: "Technical and commercial analysis of self-hosting open-source LLMs: model selection criteria, quantisation approaches (GGUF, AWQ, GPTQ), serving frameworks (vLLM, TGI, Ollama), and hardware sizing for common deployment scenarios.",
    category: "Industry Analysis",
    tier: "deep-analysis",
    priority: 77,
  },
  {
    topic: "Inference optimisation: batching, quantisation, and speculative decoding",
    description: "Techniques for maximising GPU utilisation in LLM inference: continuous batching, KV cache management, INT8/FP8 quantisation, speculative decoding, and PagedAttention. Practical implications for hardware selection.",
    category: "Industry Analysis",
    tier: "weekly-digest",
    priority: 73,
  },
  {
    topic: "The economics of AI model training in 2025",
    description: "Analysis of training costs for frontier models: compute requirements, data centre costs, operator margins, and what the economics mean for the competitive landscape and decisions about build-vs-buy for enterprise AI.",
    category: "Industry Analysis",
    tier: "weekly-digest",
    priority: 69,
  },
  {
    topic: "NCCL and collective communication in distributed training",
    description: "How NCCL (NVIDIA Collective Communications Library) works: AllReduce, AllGather, ReduceScatter algorithms, topology-awareness, and tuning guidance for multi-node training across InfiniBand and Ethernet fabrics.",
    category: "Industry Analysis",
    tier: "weekly-digest",
    priority: 66,
  },

  // ── Research Highlights ───────────────────────────────────────────
  {
    topic: "Flash Attention and its successors: memory-efficient transformers",
    description: "Technical analysis of IO-aware attention algorithms: Flash Attention 1/2/3 design principles, performance characteristics on H100 vs A100, and implications for GPU memory requirements when deploying large context window models.",
    category: "Research Highlights",
    tier: "deep-analysis",
    priority: 83,
  },
  {
    topic: "Mixture of Experts scaling: from GShard to Mixtral to the frontier",
    description: "How MoE architectures change compute requirements: sparse vs dense activation, expert routing algorithms, load balancing, and what the shift toward MoE models means for inference hardware selection and cluster sizing.",
    category: "Research Highlights",
    tier: "weekly-digest",
    priority: 74,
  },
  {
    topic: "Reinforcement learning from human feedback (RLHF) compute requirements",
    description: "Analysis of RLHF training infrastructure: PPO vs DPO vs GRPO, the memory and compute overhead of actor-critic training, and practical hardware sizing for fine-tuning and alignment workflows.",
    category: "Research Highlights",
    tier: "weekly-digest",
    priority: 67,
  },
  {
    topic: "Multimodal AI infrastructure: vision-language models and diffusion systems",
    description: "Hardware requirements for vision-language models (LLaVA, GPT-4V scale) and image/video diffusion systems: memory profiles, inference latency characteristics, and GPU selection for multimodal deployments.",
    category: "Research Highlights",
    tier: "weekly-digest",
    priority: 63,
  },
  {
    topic: "Federated learning for sensitive data: infrastructure and practical limits",
    description: "Technical assessment of federated learning for privacy-sensitive AI training in healthcare, defence, and government contexts: communication overhead, convergence behaviour, and the infrastructure required for practical deployments.",
    category: "Research Highlights",
    tier: "deep-analysis",
    priority: 71,
  },
  {
    topic: "AI at the edge: NVIDIA Jetson, Orin, and inference appliances",
    description: "Analysis of edge AI compute platforms for latency-sensitive and disconnected deployments: NVIDIA Jetson Orin NX/AGX, inference appliance form factors, and use cases in defence, resources, and remote operations.",
    category: "Research Highlights",
    tier: "weekly-digest",
    priority: 64,
  },
];

async function main() {
  console.log(`Seeding ${topics.length} editorial calendar topics…`);
  let created = 0;
  let skipped = 0;

  for (const topic of topics) {
    const existing = await prisma.editorialCalendar.findFirst({
      where: { topic: topic.topic },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.editorialCalendar.create({ data: topic });
    created++;
  }

  console.log(`Done. Created: ${created}, Skipped (already exist): ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
