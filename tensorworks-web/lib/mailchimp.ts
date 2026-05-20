import mailchimpClient from "@mailchimp/mailchimp_marketing";
import { createHash } from "crypto";
import { env } from "@/lib/env";

// Initialise on first call (optional chaining on env vars since they're optional in dev)
function getClient() {
  if (!env.MAILCHIMP_API_KEY || !env.MAILCHIMP_SERVER_PREFIX) {
    throw new Error(
      "Mailchimp not configured — set MAILCHIMP_API_KEY and MAILCHIMP_SERVER_PREFIX"
    );
  }
  mailchimpClient.setConfig({
    apiKey: env.MAILCHIMP_API_KEY,
    server: env.MAILCHIMP_SERVER_PREFIX,
  });
  return mailchimpClient;
}

const audienceId = (): string => {
  if (!env.MAILCHIMP_AUDIENCE_ID) throw new Error("MAILCHIMP_AUDIENCE_ID not set");
  return env.MAILCHIMP_AUDIENCE_ID;
};

// MD5 hash of lowercase email — Mailchimp's subscriber hash format
function subscriberHash(email: string): string {
  return createHash("md5").update(email.toLowerCase()).digest("hex");
}

export async function subscribeContact(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  mergeFields?: Record<string, string>;
  status?: "subscribed" | "pending"; // pending = double opt-in
}): Promise<string> {
  const client = getClient();
  const listId = audienceId();
  const hash = subscriberHash(params.email);

  try {
    const response = (await client.lists.setListMember(listId, hash, {
      email_address: params.email,
      status_if_new: params.status ?? "pending",
      status: params.status ?? "pending",
      merge_fields: {
        ...(params.firstName ? { FNAME: params.firstName } : {}),
        ...(params.lastName ? { LNAME: params.lastName } : {}),
        ...params.mergeFields,
      },
      tags: params.tags ?? [],
    } as any)) as any;

    return String(response.web_id ?? response.id ?? hash);
  } catch (err: any) {
    throw new Error(
      `Mailchimp subscribeContact failed for ${params.email}: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}

export async function tagContact(email: string, tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  const client = getClient();
  const listId = audienceId();
  const hash = subscriberHash(email);

  try {
    await (client.lists as any).updateListMemberTags(listId, hash, {
      tags: tags.map((name) => ({ name, status: "active" })),
    });
  } catch (err: any) {
    throw new Error(
      `Mailchimp tagContact failed for ${email}: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}

export async function untagContact(email: string, tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  const client = getClient();
  const listId = audienceId();
  const hash = subscriberHash(email);

  try {
    await (client.lists as any).updateListMemberTags(listId, hash, {
      tags: tags.map((name) => ({ name, status: "inactive" })),
    });
  } catch (err: any) {
    throw new Error(
      `Mailchimp untagContact failed for ${email}: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}

export async function unsubscribeContact(email: string): Promise<void> {
  const client = getClient();
  const listId = audienceId();
  const hash = subscriberHash(email);

  try {
    await (client.lists as any).updateListMember(listId, hash, {
      status: "unsubscribed",
    });
  } catch (err: any) {
    throw new Error(
      `Mailchimp unsubscribeContact failed for ${email}: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}

export async function getMemberInfo(email: string): Promise<{
  id: string;
  status: string;
  tags: string[];
} | null> {
  const client = getClient();
  const listId = audienceId();
  const hash = subscriberHash(email);

  try {
    const member = (await (client.lists as any).getListMember(listId, hash)) as any;
    return {
      id: String(member.id ?? member.web_id ?? hash),
      status: member.status,
      tags: Array.isArray(member.tags)
        ? member.tags.map((t: any) => (typeof t === "string" ? t : t.name))
        : [],
    };
  } catch (err: any) {
    // 404 → member doesn't exist
    const status =
      err?.status ?? err?.response?.status ?? err?.statusCode;
    if (status === 404) return null;
    throw new Error(
      `Mailchimp getMemberInfo failed for ${email}: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}

export async function createCampaign(params: {
  subject: string;
  previewText: string;
  htmlBody: string;
  textBody: string;
  segmentTag: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}): Promise<string> {
  const client = getClient();
  const listId = audienceId();

  try {
    // Create the campaign
    const campaign = (await (client.campaigns as any).create({
      type: "regular",
      recipients: {
        list_id: listId,
        segment_opts: {
          conditions: [
            {
              condition_type: "Tag",
              field: "tag",
              op: "is",
              value: params.segmentTag,
            },
          ],
          match: "all",
        },
      },
      settings: {
        subject_line: params.subject,
        preview_text: params.previewText,
        from_name: params.fromName ?? env.MAILCHIMP_FROM_NAME,
        from_email: params.fromEmail ?? env.MAILCHIMP_FROM_EMAIL,
        reply_to: params.replyTo ?? env.MAILCHIMP_REPLY_TO,
        auto_footer: false,
        inline_css: true,
      },
    })) as any;

    const campaignId: string = campaign.id;

    // Set campaign content
    await (client.campaigns as any).setContent(campaignId, {
      html: params.htmlBody,
      plain_text: params.textBody,
    });

    return campaignId;
  } catch (err: any) {
    throw new Error(
      `Mailchimp createCampaign failed: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}

export async function scheduleCampaign(
  campaignId: string,
  sendAt: Date
): Promise<void> {
  const client = getClient();

  try {
    await (client.campaigns as any).schedule(campaignId, {
      schedule_time: sendAt.toISOString(),
    });
  } catch (err: any) {
    throw new Error(
      `Mailchimp scheduleCampaign failed for campaign ${campaignId}: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}

export async function sendCampaignNow(campaignId: string): Promise<void> {
  const client = getClient();

  try {
    await (client.campaigns as any).send(campaignId);
  } catch (err: any) {
    throw new Error(
      `Mailchimp sendCampaignNow failed for campaign ${campaignId}: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}

export async function getCampaignReport(campaignId: string): Promise<{
  opens: number;
  clicks: number;
  unsubscribes: number;
  bounces: number;
  complaints: number;
  delivered: number;
} | null> {
  const client = getClient();

  try {
    const report = (await (client.reports as any).getCampaignReport(
      campaignId
    )) as any;

    return {
      opens: report.opens?.unique_opens ?? 0,
      clicks: report.clicks?.unique_clicks ?? 0,
      unsubscribes: report.unsubscribed ?? 0,
      bounces: (report.bounces?.hard_bounces ?? 0) + (report.bounces?.soft_bounces ?? 0),
      complaints: report.abuse_reports ?? 0,
      delivered: (report.emails_sent ?? 0) - (report.bounces?.hard_bounces ?? 0) - (report.bounces?.soft_bounces ?? 0),
    };
  } catch (err: any) {
    const status =
      err?.status ?? err?.response?.status ?? err?.statusCode;
    if (status === 404) return null;
    throw new Error(
      `Mailchimp getCampaignReport failed for campaign ${campaignId}: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}

export async function getAudienceSegments(): Promise<
  Array<{ id: number; name: string; memberCount: number }>
> {
  const client = getClient();
  const listId = audienceId();

  try {
    const response = (await (client.lists as any).listSegments(listId, {
      count: 200,
    })) as any;

    const segments: Array<any> = response.segments ?? [];
    return segments.map((seg: any) => ({
      id: seg.id,
      name: seg.name,
      memberCount: seg.member_count ?? 0,
    }));
  } catch (err: any) {
    throw new Error(
      `Mailchimp getAudienceSegments failed: ${err?.response?.text ?? err?.message ?? String(err)}`
    );
  }
}
