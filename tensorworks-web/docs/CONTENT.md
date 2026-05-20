# Content management

All site content is in TypeScript files under `content/`. No CMS. Changes require a redeploy.

## Content files

| File | What it controls |
|---|---|
| `content/solutions.ts` | Solutions pages — descriptions, capabilities, use cases, recommended hardware slugs |
| `content/hardware.ts` | Hardware catalogue — specs, use cases, lead times |
| `content/services.ts` | Services pages — descriptions, engagement models, deliverables, timelines |
| `content/seo.ts` | Page titles and meta descriptions |

## Adding a solution

In `content/solutions.ts`, add a new entry to the `solutions` array:

```ts
{
  slug: "your-slug",             // URL: /solutions/your-slug
  title: "Solution Name",
  subtitle: "One-line descriptor",
  description: "...",
  capabilities: ["...", "..."],
  recommendedHardware: ["h100-8gpu"],  // slugs from hardware.ts
  useCases: ["...", "..."],
}
```

Then add an SEO entry in `content/seo.ts` under `pageSEO`:

```ts
"solutions/your-slug": {
  title: "Solution Name — TensorWorks",
  description: "...",
},
```

## Adding a hardware configuration

In `content/hardware.ts`, find the appropriate category and add to its `configurations` array. If adding a new category, add to `hardwareCategories`.

## Updating lead times or specs

Edit the relevant entry in `content/hardware.ts`. Changes are reflected site-wide at next build.

## Writing style

- Australian English (not American): "organisation", "centre", "behaviour", etc.
- No prices — enquire via RFQ
- No banned phrases: see `CLAUDE.md` for the full list
- Sentence case for headings
- Specifics over generics — "H100 SXM 8-GPU" not "high-performance GPU system"

## Insights / blog

The `/insights` page is a placeholder. To add articles:

1. Create `content/insights.ts` with an array of post metadata
2. Add MDX files under `app/(marketing)/insights/[slug]/`
3. Update the insights index page to render the list

(This is a Milestone 2+ item — not yet implemented.)
