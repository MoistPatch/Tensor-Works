# Worker — Editorial Intelligence Engine

The `worker/` directory is a standalone Node.js package that runs alongside the Next.js app. It handles news monitoring, AI content generation, and review notifications.

## Architecture

```
worker/
  src/
    index.ts          — Entry point, registers all BullMQ workers
    lib/
      anthropic.ts    — Anthropic SDK wrapper (Sonnet 4.6, Opus 4.7)
      budget.ts       — Monthly AI spend tracking, cascade halt
      bannedPhrases.ts — Banned phrase detection
      copyrightCheck.ts — 8-gram Jaccard overlap check
      qualityGate.ts  — Tier-specific quality checks
      research.ts     — Web search tool for deep analysis
      redis.ts        — IORedis connection
      prisma.ts       — Prisma client (shares DB with Next.js app)
      logger.ts       — Pino logger
    fetchers/
      rssFetcher.ts   — RSS/Atom feed parser
      apiFetcher.ts   — Generic JSON API fetcher
      scrapeFetcher.ts — Cheerio-based web scraper
    jobs/
      monitorSources.ts             — Fetch news sources (every 30 min)
      clusterNews.ts                — Cluster items into topic groups (hourly)
      scoreNews.ts                  — Score relevance/sentiment (hourly +15)
      generateDailyScan.ts          — Daily scan post (weekdays 0600 AEST)
      generateWeeklyDigest.ts       — Weekly digest (Tuesdays 0700 AEST)
      assembleWeeklyDigestEmail.ts  — Assemble campaign emails when digest approved
      generateCampaign.ts           — Trigger campaigns on post publish
      sendCampaigns.ts              — Send scheduled campaigns (Tuesdays 1000 AEST)
      syncCampaignReports.ts        — Sync Mailchimp stats (daily 0400 AEST)
      bounceRateAudit.ts            — Alert on high bounce/complaint rates (daily 0800)
      consentAuditExport.ts         — Monthly consent record export (1st of month 0600)
      selectDeepAnalysisTopic.ts — Pick deep analysis topic (Mon 1200 AEST)
      generateDeepAnalysis.ts — Deep analysis (alt Tuesdays 0800 AEST)
      notifyReview.ts        — Email notifications for review queue
```

## Development

```bash
# Start Redis and Postgres
docker compose -f docker-compose.dev.yml up -d

# Install worker dependencies
cd worker
pnpm install

# Copy env
cp .env.example .env

# Run in watch mode
pnpm dev
```

## Environment variables

See `worker/.env.example`. The worker needs:
- `DATABASE_URL` — same database as the Next.js app
- `REDIS_URL` + `REDIS_PASSWORD` — BullMQ job queue backend
- `ANTHROPIC_API_KEY` — for content generation
- `RESEND_API_KEY` + `FROM_EMAIL` — for review notifications
- `ADMIN_EMAILS` — who receives review notifications
- `MONTHLY_AI_BUDGET_AUD` — cascade halt threshold (default 500)

## Content generation tiers

| Tier | Model | Schedule | Word count | Citations |
|------|-------|----------|------------|-----------|
| Daily scan | claude-sonnet-4-6 | Weekdays 0600 AEST | 400–800 | ≥2 |
| Weekly digest | claude-opus-4-7 | Tuesdays 0700 AEST | 1200–2500 | ≥5 |
| Deep analysis | claude-opus-4-7 + thinking | Alternate Tuesdays | 2500–6000 | ≥8 |

## Budget management

Monthly spend is tracked in Redis (`budget:spend:YYYY-MM`). Generation is halted at:
- 90%: warning logged
- 95%: deep analysis paused
- 100%: all generation halted

## Database migrations

After adding Milestone 2 schema changes:

```bash
pnpm prisma migrate dev --name blog_and_news_monitoring
```

## Seeding

```bash
# Seed 45 news sources
pnpm seed:news

# Seed 26 editorial calendar topics
pnpm seed:editorial
```

## Admin UI

- `/admin/content` — Review queue for generated posts
- `/admin/content/[id]` — Post editor with keyboard shortcuts (A/R/E/G/N)
- `/admin/content/calendar` — Editorial calendar
- `/admin/news` — News monitoring dashboard
- `/admin/news/sources` — Source management
- `/admin/news/items` — Item browser
- `/admin/news/clusters` — Cluster review
- `/admin/news/banned` — Banned claims management
