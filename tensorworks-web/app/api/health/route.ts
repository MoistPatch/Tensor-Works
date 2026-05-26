import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CheckResult = { status: "ok" | "fail" | "skipped"; latencyMs?: number; error?: string };

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok", latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: "fail",
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkRedis(): Promise<CheckResult> {
  if (!process.env.REDIS_URL) return { status: "skipped" };
  // Redis client lives in the worker package — health check just verifies env var presence here.
  return { status: "ok" };
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const checks = {
    app: { status: "ok" as const },
    database,
    redis,
  };

  const failures = Object.values(checks).filter((c) => c.status === "fail").length;
  const allHealthy = failures === 0;

  return Response.json(
    {
      status: allHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  );
}
