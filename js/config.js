window.TW = {
  shopify: {
    domain: 'ituspq-hc.myshopify.com',
    configured: true,
  },
  dickerData: {
    stockProxy: '/api/stock',
    pricingProxy: '/api/pricing',
    enabled: false,
  },
  products: [
    {
      "handle": "nvidia-h100-sxm5",
      "title": "NVIDIA H100 SXM5",
      "category": "GPU Accelerators",
      "sku": "NV-H100-SXM5-80",
      "priceDisplay": "POA",
      "shopifyVariantId": "43751354466382",
      "image": null,
      "iconClass": "teal",
      "icon": "fa-microchip",
      "description": "The world's most powerful AI training GPU - transformer engine, NVLink 4, SXM5 and PCIe form factors available. Purpose-built for large language model training and inference at scale.",
      "specs": [
        {
          "key": "Memory",
          "value": "80GB HBM3"
        },
        {
          "key": "Bandwidth",
          "value": "3.35TB/s"
        },
        {
          "key": "TF32 TFLOPS",
          "value": "989"
        },
        {
          "key": "Form Factor",
          "value": "SXM5 / PCIe"
        }
      ],
      "inStock": true,
      "tags": [
        "GPU",
        "NVIDIA",
        "H100",
        "Training",
        "HPC"
      ]
    },
    {
      "handle": "nvidia-h200-sxm5",
      "title": "NVIDIA H200 SXM5",
      "category": "GPU Accelerators",
      "sku": "NV-H200-SXM5",
      "priceDisplay": "POA",
      "shopifyVariantId": "43751354531918",
      "image": null,
      "iconClass": "teal",
      "icon": "fa-microchip",
      "description": "Next-generation AI superchip with HBM3e memory. Dramatically increased memory capacity and bandwidth for the most demanding generative AI and HPC workloads.",
      "specs": [
        {
          "key": "Memory",
          "value": "141GB HBM3e"
        },
        {
          "key": "Bandwidth",
          "value": "4.8TB/s"
        },
        {
          "key": "FP8 TFLOPS",
          "value": "3958"
        },
        {
          "key": "Form Factor",
          "value": "SXM5"
        }
      ],
      "inStock": false,
      "tags": [
        "GPU",
        "NVIDIA",
        "H200",
        "Training",
        "HPC"
      ]
    },
    {
      "handle": "nvidia-dgx-h200",
      "title": "NVIDIA DGX H200",
      "category": "DGX Systems",
      "sku": "NV-DGX-H200",
      "priceDisplay": "POA",
      "shopifyVariantId": "43751354597454",
      "image": null,
      "iconClass": "orange",
      "icon": "fa-server",
      "description": "The definitive AI supercomputer in a box. Eight H200 GPUs connected by NVLink with 1.1TB aggregate HBM3e memory and full InfiniBand networking for multi-node scale-out.",
      "specs": [
        {
          "key": "GPUs",
          "value": "8x H200 SXM"
        },
        {
          "key": "Total Memory",
          "value": "1.1TB HBM3e"
        },
        {
          "key": "NVLink",
          "value": "900GB/s"
        },
        {
          "key": "Networking",
          "value": "8x 400Gb IB"
        }
      ],
      "inStock": false,
      "tags": [
        "DGX",
        "NVIDIA",
        "H200",
        "System",
        "HPC"
      ]
    },
    {
      "handle": "nvidia-rtx-6000-ada",
      "title": "NVIDIA RTX 6000 Ada",
      "category": "Workstation GPU",
      "sku": "NV-RTX6000-ADA",
      "priceDisplay": "POA",
      "shopifyVariantId": "43751354662990",
      "image": null,
      "iconClass": "blue",
      "icon": "fa-desktop",
      "description": "Professional visualisation and inference GPU with ECC memory, AV1 encode/decode, and workstation-class reliability for demanding creative and AI workflows.",
      "specs": [
        {
          "key": "Memory",
          "value": "48GB GDDR6 ECC"
        },
        {
          "key": "CUDA Cores",
          "value": "18,176"
        },
        {
          "key": "RT Cores",
          "value": "3rd Gen"
        },
        {
          "key": "TDP",
          "value": "300W"
        }
      ],
      "inStock": true,
      "tags": [
        "GPU",
        "NVIDIA",
        "RTX",
        "Workstation",
        "Visualization"
      ]
    },
    {
      "handle": "nvidia-bluefield-3-dpu",
      "title": "NVIDIA BlueField-3 DPU",
      "category": "Data Processing Unit",
      "sku": "NV-BF3-400",
      "priceDisplay": "POA",
      "shopifyVariantId": "43751354728526",
      "image": null,
      "iconClass": "purple",
      "icon": "fa-network-wired",
      "description": "Data Processing Unit for AI-powered cloud infrastructure. Offloads networking, storage, and security processing from host CPUs for maximum efficiency.",
      "specs": [
        {
          "key": "Bandwidth",
          "value": "400Gb/s"
        },
        {
          "key": "Cores",
          "value": "16x Arm A78"
        },
        {
          "key": "DRAM",
          "value": "32GB LPDDR5"
        },
        {
          "key": "PCIe",
          "value": "Gen 5"
        }
      ],
      "inStock": true,
      "tags": [
        "DPU",
        "NVIDIA",
        "BlueField",
        "Networking",
        "SmartNIC"
      ]
    },
    {
      "handle": "nvidia-ai-enterprise",
      "title": "NVIDIA AI Enterprise",
      "category": "Software Suite",
      "sku": "NV-AIE-SUITE",
      "priceDisplay": "POA",
      "shopifyVariantId": "43751354761294",
      "image": null,
      "iconClass": "teal",
      "icon": "fa-brain",
      "description": "End-to-end AI software platform with enterprise support. RAPIDS, Triton, NeMo, TAO Toolkit and optimised frameworks included with 24/7 enterprise support.",
      "specs": [
        {
          "key": "Frameworks",
          "value": "PyTorch, TF, JAX"
        },
        {
          "key": "Inference",
          "value": "Triton Server"
        },
        {
          "key": "Training",
          "value": "NeMo"
        },
        {
          "key": "Support",
          "value": "24/7 Enterprise"
        }
      ],
      "inStock": true,
      "tags": [
        "Software",
        "NVIDIA",
        "AI Enterprise",
        "MLOps"
      ]
    },
    {
      "handle": "dell-poweredge-xe9680",
      "title": "Dell PowerEdge XE9680",
      "category": "Server Platform",
      "sku": "DELL-PE-XE9680",
      "priceDisplay": "POA",
      "shopifyVariantId": "43751354826830",
      "image": null,
      "iconClass": "orange",
      "icon": "fa-hdd",
      "description": "8-way GPU server optimised for AI and HPC workloads. Supports up to eight SXM5 GPUs with NVLink Switch, dual Xeon Scalable processors and up to 8TB DDR5 memory.",
      "specs": [
        {
          "key": "GPU Slots",
          "value": "8x SXM / PCIe"
        },
        {
          "key": "CPU",
          "value": "2x Xeon Scalable"
        },
        {
          "key": "Memory",
          "value": "Up to 8TB DDR5"
        },
        {
          "key": "Networking",
          "value": "IB / Ethernet"
        }
      ],
      "inStock": true,
      "tags": [
        "Server",
        "Dell",
        "PowerEdge",
        "HPC",
        "AI"
      ]
    },
    {
      "handle": "mellanox-infiniband-ndr400",
      "title": "Mellanox InfiniBand NDR400 Switch",
      "category": "Networking",
      "sku": "MLX-IB-NDR400",
      "priceDisplay": "POA",
      "shopifyVariantId": "43751354892366",
      "image": null,
      "iconClass": "green",
      "icon": "fa-network-wired",
      "description": "High-performance NDR InfiniBand switch for AI and HPC clusters. 64 ports at 400Gb/s with sub-microsecond latency, RDMA support, and full management capabilities.",
      "specs": [
        {
          "key": "Ports",
          "value": "64x 400Gb/s"
        },
        {
          "key": "Latency",
          "value": "Sub-us"
        },
        {
          "key": "Protocol",
          "value": "RDMA / RoCE"
        },
        {
          "key": "Management",
          "value": "Managed"
        }
      ],
      "inStock": true,
      "tags": [
        "Networking",
        "InfiniBand",
        "Mellanox",
        "NDR",
        "HPC"
      ]
    }
  ],
};
