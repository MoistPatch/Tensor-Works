import { Queue, Worker } from "bullmq";
import { redis } from "./lib/redis.js";
import { logger } from "./lib/logger.js";

// Job processor imports
import { monitorSourcesProcessor } from "./jobs/monitorSources.js";
import { clusterNewsProcessor } from "./jobs/clusterNews.js";
import { scoreNewsProcessor } from "./jobs/scoreNews.js";
import { generateDailyScanProcessor } from "./jobs/generateDailyScan.js";
import { generateWeeklyDigestProcessor } from "./jobs/generateWeeklyDigest.js";
import { selectDeepAnalysisTopicProcessor } from "./jobs/selectDeepAnalysisTopic.js";
import { generateDeepAnalysisProcessor } from "./jobs/generateDeepAnalysis.js";
import { notifyReviewProcessor } from "./jobs/notifyReview.js";

const connection = redis;

// Queue and schedule definitions
const jobDefinitions = [
  {
    name: "monitorSources",
    cron: "*/30 * * * *",
    processor: monitorSourcesProcessor,
  },
  {
    name: "clusterNews",
    cron: "0 * * * *",
    processor: clusterNewsProcessor,
  },
  {
    name: "scoreNews",
    cron: "15 * * * *",
    processor: scoreNewsProcessor,
  },
  {
    name: "generateDailyScan",
    // 20:00 UTC = 06:00 AEST (weekdays)
    cron: "0 20 * * 0-4",
    processor: generateDailyScanProcessor,
  },
  {
    name: "generateWeeklyDigest",
    // 21:00 UTC Tuesday = 07:00 AEST Wednesday... spec says Tuesdays 0700 AEST = 21:00 UTC Monday
    cron: "0 21 * * 1",
    processor: generateWeeklyDigestProcessor,
  },
  {
    name: "selectDeepAnalysisTopic",
    // Mondays 12:00 AEST = 02:00 UTC Monday
    cron: "0 2 * * 1",
    processor: selectDeepAnalysisTopicProcessor,
  },
  {
    name: "generateDeepAnalysis",
    // Alternate Tuesdays 08:00 AEST = 22:00 UTC Tuesday (prior day)
    cron: "0 22 * * 2",
    processor: generateDeepAnalysisProcessor,
  },
  {
    name: "notifyReview",
    // Daily 08:30 AEST = 22:30 UTC prior day
    cron: "30 22 * * *",
    processor: notifyReviewProcessor,
  },
] as const;

const queues: Queue[] = [];
const workers: Worker[] = [];

async function start() {
  logger.info("Starting TensorWorks worker process...");

  for (const def of jobDefinitions) {
    // Create queue and upsert repeatable job
    const queue = new Queue(def.name, { connection });
    await queue.upsertJobScheduler(def.name, { pattern: def.cron });
    queues.push(queue);

    // Create worker
    const worker = new Worker(def.name, def.processor, { connection });

    worker.on("completed", (job) => {
      logger.info({ queue: def.name, jobId: job.id }, "Job completed");
    });

    worker.on("failed", (job, err) => {
      logger.error(
        { queue: def.name, jobId: job?.id, err },
        "Job failed"
      );
    });

    worker.on("error", (err) => {
      logger.error({ queue: def.name, err }, "Worker error");
    });

    workers.push(worker);
    logger.info({ queue: def.name, cron: def.cron }, "Worker registered");
  }

  logger.info(
    { workerCount: workers.length },
    "All workers started successfully"
  );
}

async function shutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, gracefully stopping...");

  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(queues.map((q) => q.close()));
  await redis.quit();

  logger.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start().catch((err) => {
  logger.fatal({ err }, "Failed to start worker process");
  process.exit(1);
});
