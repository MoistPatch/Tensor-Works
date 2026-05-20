import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const sources = [
  // ── GPU & Hardware ────────────────────────────────────────────────
  { name: "NVIDIA Newsroom", url: "https://nvidianews.nvidia.com", feedUrl: "https://nvidianews.nvidia.com/rss", fetchType: "rss", category: "gpu-hardware", trustScore: 0.9 },
  { name: "NVIDIA Developer Blog", url: "https://developer.nvidia.com/blog", feedUrl: "https://developer.nvidia.com/blog/feed/", fetchType: "rss", category: "gpu-hardware", trustScore: 0.85 },
  { name: "AMD AI Blog", url: "https://community.amd.com/t5/ai/bg-p/ai", feedUrl: "https://community.amd.com/t5/ai/rss/board?board.id=ai", fetchType: "rss", category: "gpu-hardware", trustScore: 0.8 },
  { name: "Intel Newsroom", url: "https://www.intel.com/content/www/us/en/newsroom/news.html", feedUrl: "https://www.intel.com/content/www/us/en/newsroom/news.rss", fetchType: "rss", category: "gpu-hardware", trustScore: 0.8 },
  { name: "Anandtech", url: "https://www.anandtech.com", feedUrl: "https://www.anandtech.com/rss/list", fetchType: "rss", category: "gpu-hardware", trustScore: 0.75 },

  // ── AI Research ───────────────────────────────────────────────────
  { name: "arXiv cs.LG (Machine Learning)", url: "https://arxiv.org/list/cs.LG/recent", feedUrl: "https://rss.arxiv.org/rss/cs.LG", fetchType: "rss", category: "ai-research", trustScore: 0.9 },
  { name: "arXiv cs.AI", url: "https://arxiv.org/list/cs.AI/recent", feedUrl: "https://rss.arxiv.org/rss/cs.AI", fetchType: "rss", category: "ai-research", trustScore: 0.9 },
  { name: "arXiv cs.DC (Distributed Computing)", url: "https://arxiv.org/list/cs.DC/recent", feedUrl: "https://rss.arxiv.org/rss/cs.DC", fetchType: "rss", category: "ai-research", trustScore: 0.85 },
  { name: "Google DeepMind Blog", url: "https://deepmind.google/discover/blog", feedUrl: "https://deepmind.google/blog/rss.xml", fetchType: "rss", category: "ai-research", trustScore: 0.85 },
  { name: "OpenAI Blog", url: "https://openai.com/blog", feedUrl: "https://openai.com/blog/rss.xml", fetchType: "rss", category: "ai-research", trustScore: 0.8 },
  { name: "Anthropic News", url: "https://www.anthropic.com/news", feedUrl: "https://www.anthropic.com/rss.xml", fetchType: "rss", category: "ai-research", trustScore: 0.85 },
  { name: "Meta AI Blog", url: "https://ai.meta.com/blog", feedUrl: "https://ai.meta.com/blog/feed/", fetchType: "rss", category: "ai-research", trustScore: 0.8 },
  { name: "Hugging Face Blog", url: "https://huggingface.co/blog", feedUrl: "https://huggingface.co/blog/feed.xml", fetchType: "rss", category: "ai-research", trustScore: 0.8 },

  // ── AI Infrastructure & Cloud ─────────────────────────────────────
  { name: "AWS Machine Learning Blog", url: "https://aws.amazon.com/blogs/machine-learning", feedUrl: "https://aws.amazon.com/blogs/machine-learning/feed", fetchType: "rss", category: "ai-infrastructure", trustScore: 0.8 },
  { name: "Google Cloud AI Blog", url: "https://cloud.google.com/blog/products/ai-machine-learning", feedUrl: "https://cloudblog.withgoogle.com/products/ai-machine-learning/rss", fetchType: "rss", category: "ai-infrastructure", trustScore: 0.8 },
  { name: "Microsoft Azure AI Blog", url: "https://techcommunity.microsoft.com/category/azure/blog/azureai", feedUrl: "https://techcommunity.microsoft.com/gxcuf89792/rss/board?board.id=AzureAI", fetchType: "rss", category: "ai-infrastructure", trustScore: 0.8 },
  { name: "CoreWeave Blog", url: "https://www.coreweave.com/blog", feedUrl: "https://www.coreweave.com/blog/rss.xml", fetchType: "rss", category: "ai-infrastructure", trustScore: 0.75 },
  { name: "Lambda Labs Blog", url: "https://lambdalabs.com/blog", feedUrl: "https://lambdalabs.com/blog/feed", fetchType: "rss", category: "ai-infrastructure", trustScore: 0.75 },

  // ── Industry News ─────────────────────────────────────────────────
  { name: "The Register — AI", url: "https://www.theregister.com/software/ai/", feedUrl: "https://www.theregister.com/software/ai/headlines.atom", fetchType: "rss", category: "industry-news", trustScore: 0.75 },
  { name: "Ars Technica — AI", url: "https://arstechnica.com/ai", feedUrl: "https://feeds.arstechnica.com/arstechnica/ai", fetchType: "rss", category: "industry-news", trustScore: 0.8 },
  { name: "TechCrunch — AI", url: "https://techcrunch.com/category/artificial-intelligence", feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/", fetchType: "rss", category: "industry-news", trustScore: 0.7 },
  { name: "VentureBeat — AI", url: "https://venturebeat.com/ai", feedUrl: "https://venturebeat.com/ai/feed/", fetchType: "rss", category: "industry-news", trustScore: 0.7 },
  { name: "Wired — AI", url: "https://www.wired.com/tag/artificial-intelligence", feedUrl: "https://www.wired.com/feed/tag/artificial-intelligence/latest/rss", fetchType: "rss", category: "industry-news", trustScore: 0.75 },
  { name: "MIT Technology Review — AI", url: "https://www.technologyreview.com/topic/artificial-intelligence", feedUrl: "https://www.technologyreview.com/feed/", fetchType: "rss", category: "industry-news", trustScore: 0.85 },

  // ── HPC & Supercomputing ──────────────────────────────────────────
  { name: "HPCwire", url: "https://www.hpcwire.com", feedUrl: "https://www.hpcwire.com/feed/", fetchType: "rss", category: "hpc", trustScore: 0.85 },
  { name: "insideHPC", url: "https://insidehpc.com", feedUrl: "https://insidehpc.com/feed/", fetchType: "rss", category: "hpc", trustScore: 0.8 },
  { name: "TOP500 News", url: "https://www.top500.org/news", feedUrl: "https://www.top500.org/feeds/news/rss", fetchType: "rss", category: "hpc", trustScore: 0.9 },
  { name: "SC Conference", url: "https://sc-blog.org", feedUrl: "https://sc-blog.org/feed/", fetchType: "rss", category: "hpc", trustScore: 0.8 },
  { name: "Mellanox / NVIDIA Networking Blog", url: "https://developer.nvidia.com/networking/blog", feedUrl: "https://developer.nvidia.com/networking/blog/feed", fetchType: "rss", category: "hpc", trustScore: 0.8 },

  // ── Australian Tech / Defence / Sovereign ─────────────────────────
  { name: "Australian Strategic Policy Institute", url: "https://www.aspi.org.au/reports", feedUrl: "https://www.aspi.org.au/feed/rss", fetchType: "rss", category: "sovereign-defence", trustScore: 0.85 },
  { name: "InnovationAus", url: "https://www.innovationaus.com", feedUrl: "https://www.innovationaus.com/feed/", fetchType: "rss", category: "sovereign-defence", trustScore: 0.75 },
  { name: "CSIRO News", url: "https://www.csiro.au/en/news", feedUrl: "https://www.csiro.au/en/news/rss/rss.xml", fetchType: "rss", category: "sovereign-defence", trustScore: 0.85 },
  { name: "Defence Connect", url: "https://www.defenceconnect.com.au", feedUrl: "https://www.defenceconnect.com.au/feed/", fetchType: "rss", category: "sovereign-defence", trustScore: 0.75 },
  { name: "Australian Government Digital Transformation Agency", url: "https://www.dta.gov.au/news", feedUrl: "https://www.dta.gov.au/rss.xml", fetchType: "rss", category: "sovereign-defence", trustScore: 0.8 },

  // ── Procurement & Finance ─────────────────────────────────────────
  { name: "AusTender (RFTS)", url: "https://www.tenders.gov.au", feedUrl: "https://www.tenders.gov.au/Home/RSS", fetchType: "rss", category: "procurement", trustScore: 0.9 },
  { name: "CRN Australia", url: "https://www.crn.com.au", feedUrl: "https://www.crn.com.au/feed/", fetchType: "rss", category: "procurement", trustScore: 0.7 },
  { name: "ARN — AI & Infrastructure", url: "https://www.arnnet.com.au/tag/artificial-intelligence", feedUrl: "https://www.arnnet.com.au/feed/", fetchType: "rss", category: "procurement", trustScore: 0.7 },

  // ── Networking & Interconnect ─────────────────────────────────────
  { name: "InfiniBand Trade Association", url: "https://www.infinibandta.org/news", feedUrl: "https://www.infinibandta.org/feed", fetchType: "rss", category: "networking", trustScore: 0.8 },
  { name: "Network World — AI", url: "https://www.networkworld.com/blog/ai-in-networking", feedUrl: "https://www.networkworld.com/feed/", fetchType: "rss", category: "networking", trustScore: 0.7 },
  { name: "SDxCentral", url: "https://www.sdxcentral.com", feedUrl: "https://www.sdxcentral.com/feed/", fetchType: "rss", category: "networking", trustScore: 0.7 },

  // ── Storage ───────────────────────────────────────────────────────
  { name: "StorageReview", url: "https://www.storagereview.com", feedUrl: "https://www.storagereview.com/feed/", fetchType: "rss", category: "storage", trustScore: 0.75 },
  { name: "Blocks & Files", url: "https://blocksandfiles.com", feedUrl: "https://blocksandfiles.com/feed/", fetchType: "rss", category: "storage", trustScore: 0.75 },

  // ── HackerNews (filtered) ─────────────────────────────────────────
  { name: "Hacker News — Show HN", url: "https://news.ycombinator.com/show", feedUrl: "https://hnrss.org/show", fetchType: "rss", category: "community", trustScore: 0.6 },
  { name: "Hacker News — AI", url: "https://news.ycombinator.com/news", feedUrl: "https://hnrss.org/newest?q=GPU+OR+LLM+OR+inference+OR+HPC", fetchType: "rss", category: "community", trustScore: 0.6 },
];

async function main() {
  console.log(`Seeding ${sources.length} news sources…`);
  let created = 0;
  let skipped = 0;

  for (const source of sources) {
    const existing = await prisma.newsSource.findUnique({ where: { url: source.url } });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.newsSource.create({ data: source });
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
