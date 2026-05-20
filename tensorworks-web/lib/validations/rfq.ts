import { z } from "zod";

export const rfqStep1Schema = z.object({
  companyName: z.string().min(2, "Company name is required").max(200),
  abn: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{11}$/.test(val.replace(/\s/g, "")),
      "ABN must be 11 digits"
    ),
  contactName: z.string().min(2, "Contact name is required").max(200),
  role: z.string().min(1, "Role is required").max(200),
  email: z.string().email("Valid email address required"),
  phone: z.string().min(8, "Phone number is required").max(30),
  organisationType: z.enum(
    [
      "enterprise",
      "university",
      "government",
      "defence",
      "research-institute",
      "startup",
      "other",
    ],
    { error: "Please select an organisation type" }
  ),
});

export const rfqStep2Schema = z.object({
  useCase: z.string().min(10, "Please describe your use case (min 10 characters)").max(2000),
  budgetBracket: z.enum(
    [
      "under-50k",
      "50k-150k",
      "150k-500k",
      "500k-1m",
      "over-1m",
      "not-disclosed",
    ],
    { error: "Please select a budget range" }
  ),
  timeline: z.enum(
    ["asap", "1-3-months", "3-6-months", "6-12-months", "planning"],
    { error: "Please select a timeline" }
  ),
  specifications: z.string().max(5000).optional().default(""),
  procurementConstraints: z
    .array(
      z.enum([
        "itar-compliance",
        "aus-content",
        "security-clearance",
        "sole-source",
        "open-tender",
        "none",
      ])
    )
    .default([]),
});

export const rfqStep3Schema = z.object({
  referralSource: z.string().max(200).optional(),
  turnstileToken: z.string().min(1, "Security check required"),
});

export const rfqFullSchema = rfqStep1Schema
  .merge(rfqStep2Schema)
  .merge(rfqStep3Schema);

export type RFQStep1 = z.infer<typeof rfqStep1Schema>;
export type RFQStep2 = z.infer<typeof rfqStep2Schema>;
export type RFQStep3 = z.infer<typeof rfqStep3Schema>;
export type RFQFull = z.infer<typeof rfqFullSchema>;

export const organisationTypeLabels: Record<string, string> = {
  enterprise: "Enterprise / Corporate",
  university: "University / Higher Education",
  government: "Government Agency",
  defence: "Defence / Intelligence",
  "research-institute": "Research Institute",
  startup: "Startup",
  other: "Other",
};

export const budgetBracketLabels: Record<string, string> = {
  "under-50k": "Under $50,000",
  "50k-150k": "$50,000 – $150,000",
  "150k-500k": "$150,000 – $500,000",
  "500k-1m": "$500,000 – $1,000,000",
  "over-1m": "Over $1,000,000",
  "not-disclosed": "Prefer not to disclose",
};

export const timelineLabels: Record<string, string> = {
  asap: "As soon as possible",
  "1-3-months": "1–3 months",
  "3-6-months": "3–6 months",
  "6-12-months": "6–12 months",
  planning: "Still in planning",
};

export const procurementConstraintLabels: Record<string, string> = {
  "itar-compliance": "ITAR compliance required",
  "aus-content": "Australian content / AIP required",
  "security-clearance": "Security clearance environment",
  "sole-source": "Sole source / panel arrangement",
  "open-tender": "Open tender / panel process",
  none: "No specific constraints",
};
