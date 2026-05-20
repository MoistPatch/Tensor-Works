export interface Challenge {
  heading: string;
  body: string;
}

export interface Approach {
  heading: string;
  body: string;
}

export interface Solution {
  slug: string;
  title: string;
  subtitle: string;
  tagline: string;
  description: string;
  overview: string;
  challenges: Challenge[];
  approach: Approach[];
  capabilities: string[];
  capabilityDetail: string;
  recommendedHardware: string[];
  useCases: string[];
  agsvaCleared?: boolean;
  sovereignRequirements?: boolean;
}

export const solutions: Solution[] = [
  {
    slug: "llm-training",
    title: "LLM Training",
    subtitle: "Multi-GPU systems for foundation model training and fine-tuning",
    tagline: "Deterministic throughput. High-bandwidth interconnects. Storage that keeps pace.",
    description:
      "Training large language models requires deterministic throughput, high-bandwidth GPU interconnects, and storage that can sustain the data pipeline. We configure systems for Australian research institutions and enterprises that need to run these workloads on-premise — not in a hyperscaler.",
    overview:
      "Foundation model training and fine-tuning place specific, exacting demands on hardware. GPU interconnect bandwidth determines how quickly gradient updates propagate across cards and nodes. Storage throughput determines whether the data pipeline keeps the GPUs saturated. Cooling and power stability determine whether a 72-hour training run completes without incident. We design systems where each of these subsystems is sized to the workload — not to a catalogue configuration.",
    challenges: [
      {
        heading: "Interconnect bottlenecks kill scaling efficiency",
        body: "Adding more GPUs does not scale linearly unless the interconnect can keep pace. PCIe-connected multi-GPU systems hit a bandwidth ceiling quickly. NVLink-connected servers with InfiniBand between nodes can sustain near-linear scaling to hundreds of GPUs — but only if the fabric is correctly configured for the collective operations your training framework uses.",
      },
      {
        heading: "Storage starvation is the hidden throughput killer",
        body: "A misconfigured storage layer will starve GPUs regardless of their spec. Data loading pipelines for large-scale pre-training require parallel file systems capable of sustained sequential read throughput in the hundreds of gigabytes per second. Off-the-shelf NAS appliances are not designed for this access pattern.",
      },
      {
        heading: "Long training runs require hardware stability, not just peak spec",
        body: "A server that passes a 30-minute benchmark but fails during a 4-day training run costs more than a slower system that completes reliably. Burn-in testing, thermal validation, and firmware-level stability tuning are not optional for training infrastructure.",
      },
      {
        heading: "Australian procurement adds complexity",
        body: "NVIDIA H100 and H200 GPUs are subject to export controls. Lead times are long. Hyperscaler wait lists for on-demand access to these GPUs can stretch months. Organisations that need consistent, dedicated access to training-class compute have limited options in Australia — which is why we focus on this gap.",
      },
    ],
    approach: [
      {
        heading: "Interconnect-first design",
        body: "We start with your model size, batch strategy, and parallelism approach to determine the interconnect requirements. For single-node workloads, NVLink-connected HGX systems with NVSwitch fabric provide full bisection bandwidth. For multi-node, we design InfiniBand fabrics sized for the collective operation pattern of your training framework — NCCL, DeepSpeed, or Megatron-LM.",
      },
      {
        heading: "Storage matched to the pipeline",
        body: "We integrate parallel file systems — GPFS, Lustre, or BeeGFS — sized for your dataset access pattern. For checkpoint-heavy workloads, we provision fast local NVMe for checkpoint staging alongside the parallel file system for dataset streaming. Caching tiers are configured per job type.",
      },
      {
        heading: "Thermal and power validation before delivery",
        body: "Every training system runs a minimum 72-hour burn-in under full GPU load before it leaves our facility. We measure thermal stability, DRAM error rates, and GPU performance consistency across the burn period. Systems that do not meet specification are remediated and re-tested — not shipped.",
      },
      {
        heading: "Software environment commissioning",
        body: "We deliver systems with DCGM-based monitoring configured, driver and CUDA versions validated against your training framework, and container environments pre-built and tested. If you run SLURM or Kubernetes, we configure the job scheduler to the system before handover.",
      },
    ],
    capabilities: [
      "NVLink and InfiniBand fabric configuration for multi-node training",
      "NVIDIA H100, H200, and B200 GPU clusters",
      "Parallel file system integration (GPFS, Lustre, BeeGFS)",
      "DCGM-based health monitoring and alerting",
      "Custom BIOS and firmware tuning for training stability",
      "72-hour burn-in and thermal validation for every system",
      "SLURM and Kubernetes job scheduler configuration",
      "Container environment pre-commissioning (PyTorch, JAX, TensorFlow)",
    ],
    capabilityDetail:
      "Our training system capability spans hardware design, component sourcing, system integration, fabric commissioning, software environment setup, and ongoing support. We have configured systems from single 8-GPU nodes to multi-node clusters, with InfiniBand fabrics ranging from HDR to NDR400 depending on the collective operation requirements.",
    recommendedHardware: ["h200-8gpu", "h100-cluster-4node"],
    useCases: [
      "Foundation model pre-training",
      "Domain-specific fine-tuning (medical, legal, government)",
      "RLHF and preference optimisation pipelines",
      "Multimodal model training",
      "Continual learning and model refresh workflows",
    ],
  },
  {
    slug: "inference",
    title: "Inference at Scale",
    subtitle: "Low-latency serving infrastructure for production AI deployments",
    tagline: "Latency SLAs met. Token throughput maximised. GPU memory not wasted.",
    description:
      "Inference workloads have different constraints to training: latency SLAs, concurrent request handling, and cost-per-token efficiency. We design systems that match your throughput requirements without over-provisioning GPU memory you will not use.",
    overview:
      "Production inference infrastructure is not a training system running backwards. The constraints are different: time-to-first-token latency, sustained request throughput under concurrent load, KV cache sizing for your context window, and total cost per million tokens. Getting these wrong means either failing your SLA or paying for GPU memory that sits idle. We design inference systems around your actual request distribution — not a worst-case peak that never occurs.",
    challenges: [
      {
        heading: "KV cache sizing is workload-specific and usually wrong",
        body: "KV cache requirements are a function of model size, context length, and concurrent request count. Over-provision the KV cache and you waste expensive HBM on capacity that never fills. Under-provision and you hit cache eviction under load, causing latency spikes at exactly the wrong moment. Most off-the-shelf inference configurations are not tuned to a specific request distribution.",
      },
      {
        heading: "Batching strategy determines cost efficiency",
        body: "Continuous batching, static batching, and chunked prefill have different performance profiles depending on request arrival rate, prompt length distribution, and output token distribution. Choosing the wrong strategy for your workload can double cost-per-token without changing hardware.",
      },
      {
        heading: "Multi-model serving complicates GPU allocation",
        body: "Organisations running multiple models — embedding models, rerankers, generation models, and classifiers — face a GPU allocation problem. Model swapping is expensive. Dedicated GPU allocation wastes capacity during off-peak periods. Tensor parallelism across cards has a communication overhead. The right answer depends on your request mix.",
      },
      {
        heading: "Integration with existing API infrastructure",
        body: "Production inference systems need to integrate with API gateways, observability stacks, and rate limiting infrastructure. vLLM and TensorRT-LLM have different integration patterns. Getting this wrong means debugging distributed tracing gaps under production load.",
      },
    ],
    approach: [
      {
        heading: "Request distribution analysis before hardware selection",
        body: "We work from your actual or estimated request distribution — prompt length percentiles, output token distribution, concurrent request count, and latency SLA — to calculate KV cache requirements and determine the minimum hardware configuration that meets your SLA at your cost target.",
      },
      {
        heading: "Framework selection matched to the model and SLA",
        body: "vLLM is the right choice for most general-purpose serving. TensorRT-LLM is the right choice when you need maximum throughput for a fixed model on NVIDIA hardware and can accept a longer setup process. We configure and benchmark both for your workload before recommending.",
      },
      {
        heading: "Disaggregated prefill-decode where it makes sense",
        body: "For workloads with long prompts and short outputs — document processing, summarisation, classification — separating prefill and decode across different GPU pools can significantly improve token throughput. We design and commission disaggregated architectures where the workload justifies the additional complexity.",
      },
      {
        heading: "Observability from day one",
        body: "We instrument inference systems with latency percentile tracking, queue depth monitoring, KV cache utilisation metrics, and per-model request rate dashboards before handover. You should know your inference system is degrading before your users notice.",
      },
    ],
    capabilities: [
      "vLLM and TensorRT-LLM optimised configurations",
      "KV cache sizing for your context window and request distribution",
      "Continuous batching and chunked prefill configuration",
      "Load balancing across GPU nodes",
      "Disaggregated prefill-decode architectures",
      "Multi-model serving and GPU allocation strategies",
      "Integration with existing API gateway and observability stacks",
      "Latency SLA validation under simulated production load",
    ],
    capabilityDetail:
      "We have commissioned inference systems from single-GPU L40S deployments through to multi-node tensor-parallel configurations. Our capability includes framework selection, configuration, load testing, observability setup, and integration with existing API infrastructure. We validate latency SLAs under realistic request distributions before handover.",
    recommendedHardware: ["l40s-inference", "h100-inference-4gpu"],
    useCases: [
      "Production LLM API serving",
      "RAG pipeline backends",
      "Document processing and summarisation at scale",
      "Real-time classification and embedding",
      "Multi-tenant model serving platforms",
    ],
  },
  {
    slug: "research-hpc",
    title: "Research and HPC",
    subtitle: "Compute infrastructure for universities and research institutions",
    tagline: "Sovereign supply chain. Compliance documentation. Research scheduler integration.",
    description:
      "Australian research institutions face unique procurement constraints: ITAR compliance, data sovereignty requirements, and the need to demonstrate local economic benefit. We have experience navigating these requirements and supplying systems that satisfy both technical and compliance needs.",
    overview:
      "University and research HPC procurement is not a standard enterprise sale. Funding comes from grant rounds with fixed expenditure windows. Procurement must satisfy university governance, ITAR regulations for certain hardware, and often ARC or NHMRC funding conditions that require Australian Industry Participation documentation. The system must integrate with existing HPC schedulers, research data management platforms, and institutional network infrastructure. We have built systems for Australian universities and research institutes under these conditions.",
    challenges: [
      {
        heading: "Grant funding creates hard expenditure windows",
        body: "GPU hardware procurement funded by ARC or NHMRC grants must be committed and often delivered within a financial year. Lead times for H100 and H200 GPUs can exceed this window without proactive allocation. We maintain allocation relationships with distributors to give funded research institutions priority access when timelines are tight.",
      },
      {
        heading: "ITAR compliance is frequently misunderstood",
        body: "Not all NVIDIA GPUs are ITAR-controlled. The controls apply to specific export categories based on performance thresholds. Research institutions sometimes apply blanket ITAR caution that is unnecessary, or miss controls that do apply. We provide clear guidance on which hardware requires which compliance documentation.",
      },
      {
        heading: "Multi-project GPU allocation requires scheduler sophistication",
        body: "Research HPC systems typically serve multiple projects with different priority levels, different resource requirements, and different user groups. SLURM partitioning, GPU MIG configuration, and fair-share scheduling need to be configured correctly to avoid one large job monopolising the cluster.",
      },
      {
        heading: "Research data management integration is often underspecified",
        body: "Research institutions often have existing data management platforms — Research Data Management Systems, institutional object stores, or existing HPC storage. New GPU infrastructure must integrate with these without creating data silos or security boundary violations.",
      },
    ],
    approach: [
      {
        heading: "Procurement timeline planning from grant award",
        body: "We engage early in the procurement cycle — ideally at grant award stage — to plan hardware allocation, procurement timeline, and delivery to fit the funding window. For competitive grant rounds, we can provide hardware specifications and cost estimates suitable for inclusion in grant applications.",
      },
      {
        heading: "Compliance documentation as a deliverable",
        body: "We produce supply chain provenance documentation, ITAR classification assessments, and Australian Industry Participation plans as project deliverables — not afterthoughts. These documents are structured for submission to university procurement offices and government funding bodies.",
      },
      {
        heading: "HPC scheduler integration and user environment setup",
        body: "We configure SLURM or PBS with GPU-aware scheduling, partition structures matched to your project mix, and fair-share policies. Container environments (Singularity/Apptainer) are pre-built for the research frameworks your institution uses. User onboarding documentation is a standard deliverable.",
      },
      {
        heading: "Storage and data management integration",
        body: "We design storage architectures that integrate with existing institutional data management. Parallel file system performance is validated against the actual research workloads — bioinformatics pipelines, climate model checkpointing, genomics data access patterns. We do not assume a generic I/O profile.",
      },
    ],
    capabilities: [
      "Sovereign supply chain provenance documentation",
      "ITAR compliance classification and documentation",
      "Australian Industry Participation plan preparation",
      "Integration with SLURM and PBS job schedulers",
      "GPU MIG configuration and multi-project partitioning",
      "Research data management storage integration",
      "Singularity/Apptainer container environment pre-commissioning",
      "Grant procurement timeline planning and cost estimation",
    ],
    capabilityDetail:
      "We have supplied GPU infrastructure to Australian universities under ARC and NHMRC funding conditions. Our compliance documentation capability covers ITAR classification, sovereign supply chain provenance, and Australian Industry Participation plans. We have integrated with SLURM, PBS, and Open XDMoD for scheduler configuration and usage reporting.",
    recommendedHardware: ["h100-cluster-4node", "a100-research"],
    useCases: [
      "Bioinformatics, genomics, and proteomics workloads",
      "Climate and earth systems modelling",
      "Computational materials science and quantum chemistry",
      "Natural language processing and computational linguistics research",
      "Computer vision and robotics research",
    ],
    sovereignRequirements: true,
  },
  {
    slug: "defence",
    title: "Defence and Classified Compute",
    subtitle: "Sovereign AI compute for sensitive and classified environments",
    tagline: "Documented provenance. Cleared personnel. Configured for air-gap.",
    description:
      "Defence and intelligence applications require hardware that has been sourced, configured, and delivered through a documented Australian supply chain. We supply systems designed for secure environments — air-gapped deployments, ruggedised configurations, and full provenance documentation.",
    overview:
      "AI compute for defence and classified environments is not a standard procurement. Hardware must be sourced through a documented, auditable supply chain. Personnel involved in configuration and delivery may require security clearances. Systems must be designed to operate in air-gapped environments with no dependency on cloud services, remote management infrastructure, or internet-connected update channels. We have the supply chain documentation capability, personnel clearance pathways, and system design experience to supply this class of infrastructure.",
    challenges: [
      {
        heading: "Supply chain integrity cannot be assumed",
        body: "Commercial GPU servers move through multiple hands — manufacturer, distributor, integrator — with limited documentation of what happened at each step. For classified environments, this is unacceptable. Every component, every firmware version, and every configuration change must be documented and auditable.",
      },
      {
        heading: "Air-gapped systems must be fully self-contained",
        body: "Systems deployed in classified environments cannot phone home for driver updates, licence validation, or telemetry. Software stacks must be fully self-contained: drivers, CUDA, inference frameworks, container runtimes, and monitoring agents must all operate without outbound connectivity. This is a different integration problem from standard enterprise deployment.",
      },
      {
        heading: "Ruggedised requirements vary by deployment context",
        body: "Not all defence deployments are in controlled data centres. Field-deployed systems face shock, vibration, dust, humidity, and temperature ranges that standard server hardware is not rated for. The ruggedisation requirement must be matched to the deployment context — a ship's computing room has different requirements to a forward operating base.",
      },
      {
        heading: "Security clearance requirements constrain who can do the work",
        body: "Some classified deployments require that personnel involved in configuration, installation, and support hold appropriate AGSVA security clearances. We have cleared personnel available for engagements that require this, and we maintain the personnel security management processes required to sustain clearances.",
      },
    ],
    approach: [
      {
        heading: "Documented supply chain from component to delivery",
        body: "We maintain records of component sourcing, firmware versions applied, configuration changes made, and personnel involved at each stage of integration. For classified engagements, this documentation is produced in a format suitable for submission to the relevant security authority. We do not rely on distributor documentation alone.",
      },
      {
        heading: "Air-gap commissioning as a standard process",
        body: "We commission air-gapped systems in our facility before delivery — running the full software stack in an isolated network environment to validate that every component operates correctly without outbound connectivity. This catches dependencies on external services that would only surface after delivery to a classified facility.",
      },
      {
        heading: "AGSVA-cleared personnel for sensitive engagements",
        body: "Our AGSVA-cleared team members can be engaged for work that requires cleared access — system configuration in classified facilities, on-site installation, and ongoing support under security authority direction. We manage personnel security requirements as part of the project plan.",
      },
      {
        heading: "Ruggedisation matched to the deployment environment",
        body: "We specify ruggedisation to MIL-SPEC requirements appropriate to the deployment environment. This includes shock and vibration ratings, operating temperature ranges, ingress protection ratings, and EMI compliance where required. We work with ruggedised enclosure suppliers to design configurations not available off the shelf.",
      },
    ],
    capabilities: [
      "AGSVA-cleared personnel for classified engagements",
      "Full supply chain provenance documentation",
      "Air-gapped deployment commissioning and validation",
      "Hardware security module (HSM) integration",
      "Ruggedised chassis to MIL-SPEC requirements",
      "End-to-end delivery, installation, and site commissioning",
      "Firmware and software stack pinning for offline environments",
      "Australian Industry Capability documentation for Defence procurement",
    ],
    capabilityDetail:
      "Our defence and classified compute capability is built around documented process, cleared personnel, and systems designed from the ground up for isolated operation. We hold AGSVA security clearances at the appropriate levels for the engagements we take on, and we do not subcontract classified work to personnel who do not hold the required clearances.",
    recommendedHardware: ["h100-secure", "l40s-ruggedised"],
    useCases: [
      "On-premise intelligence analysis",
      "Secure document processing and classification",
      "Autonomous systems development and testing",
      "Geospatial AI and imagery analysis",
      "Sovereign model training for classified datasets",
    ],
    agsvaCleared: true,
    sovereignRequirements: true,
  },
  {
    slug: "edge",
    title: "Edge AI",
    subtitle: "Compact, power-efficient inference at the point of decision",
    tagline: "Compute at the sensor. Decisions without the data centre.",
    description:
      "Some workloads cannot go to a data centre — latency requirements, connectivity constraints, or data sovereignty requirements mean the compute must sit alongside the sensor or actuator. We build edge AI appliances for industrial, remote, and secure environments.",
    overview:
      "Edge AI is not a diminished version of data centre AI — it is a different engineering problem. The constraint set is power budget, physical envelope, operating environment, connectivity, and manageability in remote or isolated locations. The right hardware platform, enclosure, and software stack depend on the specific deployment context. We design edge AI appliances from the sensor interface to the network edge, and we validate them in conditions representative of the deployment environment.",
    challenges: [
      {
        heading: "Power budgets are non-negotiable in field deployments",
        body: "A field-deployed edge system may be powered by solar, battery, or a limited generator capacity. Data centre GPUs are not an option. The compute platform must deliver sufficient inference throughput within a power envelope that the deployment environment can sustain — 15W, 50W, or 200W depending on context.",
      },
      {
        heading: "Operating environments are harsh",
        body: "Industrial and field deployments expose hardware to temperature ranges, humidity, vibration, and dust that standard compute hardware is not rated for. Thermal management in an enclosure without forced-air cooling at 45°C ambient requires careful thermal design — not just a standard server in a box.",
      },
      {
        heading: "Connectivity is unreliable or absent",
        body: "Edge systems in remote, maritime, or underground environments cannot depend on reliable connectivity. The inference pipeline must operate fully locally, with connectivity used only for periodic data synchronisation, remote management, and model updates when available. This changes the software architecture.",
      },
      {
        heading: "Fleet management at scale",
        body: "Deploying ten edge systems is a manual process. Deploying one hundred requires automated provisioning, over-the-air update capability, remote health monitoring, and the ability to diagnose and recover from failures without a site visit. Most edge AI deployments underestimate the operational tooling requirement.",
      },
    ],
    approach: [
      {
        heading: "Platform selection matched to the power and inference requirement",
        body: "NVIDIA Jetson Orin covers the 10–60W range with competitive performance for standard vision and NLP inference workloads. Discrete GPU appliances in the 150–300W range suit higher-throughput requirements. We benchmark candidate platforms on your actual model before recommending hardware.",
      },
      {
        heading: "Enclosure design for the deployment environment",
        body: "We design or specify enclosures rated for the operating environment — IP65 or higher for outdoor or wash-down environments, MIL-STD-810 shock and vibration for vehicle or aircraft mount, or hazardous area ratings where required. Thermal design is validated by simulation before fabrication.",
      },
      {
        heading: "Connectivity architecture for intermittent links",
        body: "We design software architectures that operate correctly in disconnected mode and synchronise efficiently when connectivity is available. This includes store-and-forward pipelines, delta synchronisation for model updates, and remote management via satellite or LTE with appropriate bandwidth efficiency.",
      },
      {
        heading: "Fleet management tooling from the first deployment",
        body: "We configure remote management infrastructure — typically based on Balena, Fleet DM, or a custom Ansible/Netdata stack — from the first device. Retrofitting fleet management to an existing deployment is significantly more expensive than building it in from the start.",
      },
    ],
    capabilities: [
      "NVIDIA Jetson AGX Orin and Orin NX embedded systems",
      "Discrete GPU appliances in custom enclosures",
      "Ruggedised enclosures rated to IP65, IP67, and MIL-STD-810",
      "LTE, WiFi 6E, and satellite connectivity integration",
      "Remote management via secure out-of-band interfaces",
      "Offline-first inference pipeline architecture",
      "Fleet management and over-the-air update infrastructure",
      "Custom enclosure design and thermal validation",
    ],
    capabilityDetail:
      "Our edge AI capability spans compute platform selection, enclosure design, connectivity integration, inference pipeline architecture, and fleet management setup. We have deployed edge AI appliances in industrial, agricultural, and remote monitoring contexts across Australia. Enclosure designs are validated thermally and mechanically before production.",
    recommendedHardware: ["orin-agx", "edge-inference-1u"],
    useCases: [
      "Industrial computer vision and defect detection",
      "Remote monitoring and anomaly detection",
      "Autonomous vehicle and UAV perception systems",
      "Smart infrastructure and traffic management",
      "Agricultural monitoring and precision sensing",
    ],
  },
];
