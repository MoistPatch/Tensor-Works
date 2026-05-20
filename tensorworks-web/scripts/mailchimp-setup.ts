/**
 * Idempotent Mailchimp setup script.
 * Run once before going live: pnpm mailchimp:setup
 */

import mailchimp from "@mailchimp/mailchimp_marketing";

const apiKey = process.env.MAILCHIMP_API_KEY;
const serverPrefix = process.env.MAILCHIMP_SERVER_PREFIX;
const audienceId = process.env.MAILCHIMP_AUDIENCE_ID;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tensorworks.com.au";

if (!apiKey || !serverPrefix || !audienceId) {
  console.error("Error: MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, and MAILCHIMP_AUDIENCE_ID must be set.");
  process.exit(1);
}

mailchimp.setConfig({ apiKey, server: serverPrefix });

const SEGMENTS = [
  { name: "Newsletter Subscribers", tag: "newsletter_signup" },
  { name: "RFQ Submitters", tag: "rfq_submitter" },
  { name: "Customers", tag: "customer" },
  { name: "Cold Outbound", tag: "cold_outbound" },
];

async function main() {
  // 1. Verify connection
  try {
    await (mailchimp as any).ping.get();
    console.log("✓ Mailchimp API connection verified");
  } catch (err) {
    console.error("✗ Mailchimp API connection failed:", err);
    process.exit(1);
  }

  // 2. Verify audience
  let audience: any;
  try {
    audience = await (mailchimp as any).lists.getList(audienceId);
    console.log(`✓ Audience found: "${audience.name}" (${audience.stats.member_count} members)`);
  } catch (err) {
    console.error("✗ Audience not found:", err);
    process.exit(1);
  }

  // 3. Enable double opt-in
  try {
    await (mailchimp as any).lists.updateList(audienceId, {
      name: audience.name,
      permission_reminder: audience.permission_reminder,
      email_type_option: false,
      contact: audience.contact,
      campaign_defaults: audience.campaign_defaults,
      double_optin: true,
    });
    console.log("✓ Double opt-in enabled");
  } catch (err) {
    console.warn("⚠ Could not update double opt-in setting:", (err as any)?.response?.text ?? err);
  }

  // 4. Create segments (tags are auto-created when applied to members)
  //    Mailchimp segments based on tags are query-based — we just verify tag existence by listing
  const existingTagsResp = await (mailchimp as any).lists.tagSearch(audienceId, { name: "" });
  const existingTagNames: string[] = (existingTagsResp.tags ?? []).map((t: any) => t.name);

  for (const seg of SEGMENTS) {
    if (existingTagNames.includes(seg.tag)) {
      console.log(`  ✓ Tag exists: ${seg.tag}`);
    } else {
      console.log(`  — Tag not yet used: ${seg.tag} (will be created when first subscriber is tagged)`);
    }
  }

  // 5. Print webhook instructions
  console.log("\n─────────────────────────────────────────────────────────────────");
  console.log("Manual steps required:");
  console.log("");
  console.log("1. Configure Mailchimp webhook:");
  console.log(`   URL: ${siteUrl}/api/mailchimp/webhook?secret=YOUR_WEBHOOK_SECRET`);
  console.log("   Events: subscribe, unsubscribe, profile, cleaned, upemail");
  console.log("   Go to: Audience → Manage audience → Settings → Webhooks");
  console.log("");
  console.log("2. Configure welcome sequence (Customer Journey):");
  console.log("   Mailchimp → Automations → Customer Journeys → Create");
  console.log("   Trigger: 'Joins audience' with tag filter: newsletter_signup");
  console.log("   Steps:");
  console.log("     - Wait until double opt-in confirmed");
  console.log("     - Send 'Welcome 1' campaign (template in /emails/marketing/Welcome.tsx)");
  console.log("     - Wait 3 days");
  console.log("     - Send 'Welcome 2' campaign (template in /emails/marketing/Welcome2.tsx)");
  console.log("     - Wait 4 days");
  console.log("     - Send 'Welcome 3' campaign (template in /emails/marketing/Welcome3.tsx)");
  console.log("");
  console.log("3. Configure re-engagement automation:");
  console.log("   Trigger: subscriber hasn't opened any email in 90 days");
  console.log("   Send: Reengagement template (/emails/marketing/Reengagement.tsx)");
  console.log("─────────────────────────────────────────────────────────────────");
  console.log("\nMailchimp setup complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
