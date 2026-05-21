# Content Engine Operations

How the three-tier AI editorial system works and how to operate it. See `docs/WORKER.md` for worker deployment.

## The three tiers

| Tier | Cadence | Model | Length | Trigger |
|------|---------|-------|--------|---------|
| `daily-scan` | Every weekday 0600 AEST | Claude Sonnet 4.6 | ~400 words | Cron job; pulls from monitored news sources |
| `weekly-digest` | Tuesday 0700 AEST | Claude Sonnet 4.6 | ~800 words | Rolls up the week's daily scans |
| `deep-analysis` | Fortnightly | Claude Opus 4.7 | 2000+ words | Admin selects topic; generated on approval |
| `evergreen` | Manual | Claude Opus 4.7 | Variable | Hand-curated foundational content |

## News monitoring

- ~45 sources defined in `NewsSource` table (RSS, API, scrape per source)
- Cron job fetches new items, deduplicates by URL
- Items are scored for relevance (Claude embedding-based)
- Triangulation groups items covering the same story across multiple sources — required for daily scan inclusion (single-source items are excluded as unverified)

Add a new source:
```bash
pnpm tsx scripts/seed-news-sources.ts  # idempotent — add to the seed file then re-run
```

Manage source health: each `NewsSource` records `fetchErrors`, `lastFetchedAt`. Sources with errors above threshold are auto-disabled.

## Quality gate

Every generated post passes through `lib/qualityGate.ts` before reaching `pending_review` status:

- **Banned phrases** — flagged terms like "revolutionary", "cutting-edge", "AI-powered", "leverage", "harness" — rejected and regenerated
- **Banned claims** — patterns from `BannedClaim` table (e.g. unverifiable performance claims)
- **Word count** — minimum per tier (daily 250, weekly 600, deep 1800)
- **Citation count** — minimum 2 for daily, 4 for weekly, 6+ for deep
- **Heading structure** — H2/H3 hierarchy must be sensible
- **URL validity** — every citation URL must resolve to 200 (checked at generation time)
- **Copyright overlap** — n-gram Jaccard < 5% against any single source

Quality reports are stored on `GenerationLog.qualityReport`. Posts that fail are regenerated up to 3 times before halting and alerting.

## Editorial calendar

`EditorialCalendar` defines upcoming deep-analysis topics:
- Priority (1-100)
- Target week
- Admin override flag

The deep-analysis topic selection job picks the highest-priority queued item for the current week. Operators can re-prioritise via direct DB update or seed re-run.

## Cost management

- Each `GenerationLog` records `promptTokens`, `completionTokens`, `costAud`
- `MONTHLY_AI_BUDGET_AUD` env var sets the monthly cap
- The generation worker checks the running total before each job and halts when exceeded
- Reset: budget rolls over at the start of each calendar month

## Performance review

Monthly review cadence:
- Top 5 posts by GA4 page views
- Average reading time per tier
- RFQ submissions attributed to content (UTM tracking on CTAs)
- Subscriber growth split by signup source

## Regenerating drafts

If a generated post is wrong-shaped but not quality-rejected, the operator can:
- Edit directly in the DB (no admin UI; use `psql` or a DB client)
- Update `status` to `pending_review` to re-enqueue for re-approval
- Or delete the `BlogPost` row and re-trigger the relevant job

## Adjusting banned phrases and claims

Banned phrases live in `lib/qualityGate.ts` as a constant array. Edit and redeploy.

Banned claims are dynamic — add via direct DB insert to `BannedClaim`:
```sql
INSERT INTO "BannedClaim" (pattern, reason, "addedBy") VALUES ('99\.9% uptime', 'unverifiable', 'sam@tensorworks.online');
```
