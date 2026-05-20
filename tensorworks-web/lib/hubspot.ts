import { env } from "@/lib/env";
import type { RFQFull } from "@/lib/validations/rfq";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

async function hubspotFetch(
  path: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  const url = `${HUBSPOT_API_BASE}${path}`;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.HUBSPOT_API_KEY}`,
    ...((options.headers as Record<string, string>) || {}),
  };

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 429) {
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
    }
  }
  throw new Error("HubSpot request failed after retries");
}

export async function createHubSpotContact(
  data: RFQFull
): Promise<string | null> {
  try {
    const response = await hubspotFetch("/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          email: data.email,
          firstname: data.contactName.split(" ")[0] ?? data.contactName,
          lastname: data.contactName.split(" ").slice(1).join(" ") || "",
          phone: data.phone,
          company: data.companyName,
          jobtitle: data.role,
        },
      }),
    });

    if (!response.ok) {
      if (response.status === 409) {
        const error = await response.json();
        return error.message?.match(/ID: (\d+)/)?.[1] ?? null;
      }
      return null;
    }

    const json = await response.json();
    return json.id ?? null;
  } catch {
    return null;
  }
}

export async function createHubSpotDeal(
  data: RFQFull,
  contactId: string | null
): Promise<string | null> {
  try {
    const response = await hubspotFetch("/crm/v3/objects/deals", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          dealname: `RFQ – ${data.companyName}`,
          pipeline: "default",
          dealstage: "appointmentscheduled",
          description: data.useCase,
          amount: "",
        },
        associations: contactId
          ? [
              {
                to: { id: contactId },
                types: [
                  { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 },
                ],
              },
            ]
          : [],
      }),
    });

    if (!response.ok) return null;
    const json = await response.json();
    return json.id ?? null;
  } catch {
    return null;
  }
}
