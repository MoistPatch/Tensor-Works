import { Resend } from "resend";
import { env } from "@/lib/env";
import type { RFQFull } from "@/lib/validations/rfq";
import {
  organisationTypeLabels,
  budgetBracketLabels,
  timelineLabels,
} from "@/lib/validations/rfq";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendRFQNotification(
  data: RFQFull,
  submissionId: string
): Promise<void> {
  const constraints =
    data.procurementConstraints.length > 0
      ? data.procurementConstraints.join(", ")
      : "None specified";

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to: env.NOTIFICATION_EMAIL,
    subject: `New RFQ – ${data.companyName} [${submissionId}]`,
    text: [
      `New RFQ submission received — ${new Date().toISOString()}`,
      "",
      `ID: ${submissionId}`,
      `Company: ${data.companyName}${data.abn ? ` (ABN ${data.abn})` : ""}`,
      `Contact: ${data.contactName}, ${data.role}`,
      `Email: ${data.email}`,
      `Phone: ${data.phone}`,
      `Organisation type: ${organisationTypeLabels[data.organisationType] ?? data.organisationType}`,
      "",
      `Budget: ${budgetBracketLabels[data.budgetBracket] ?? data.budgetBracket}`,
      `Timeline: ${timelineLabels[data.timeline] ?? data.timeline}`,
      `Procurement constraints: ${constraints}`,
      "",
      "Use case:",
      data.useCase,
      "",
      data.specifications
        ? `Technical specifications:\n${data.specifications}`
        : "No additional specifications provided.",
      "",
      data.referralSource ? `Referral source: ${data.referralSource}` : "",
    ]
      .filter((line) => line !== undefined)
      .join("\n"),
  });
}

export async function sendRFQAcknowledgement(data: RFQFull): Promise<void> {
  await resend.emails.send({
    from: env.FROM_EMAIL,
    to: data.email,
    subject: "Your RFQ has been received — TensorWorks",
    text: [
      `Dear ${data.contactName},`,
      "",
      "Thank you for submitting a Request for Quote to TensorWorks.",
      "",
      "Our engineering team will review your requirements and respond within two business days. If we need any clarification, we will reach out on the contact details you provided.",
      "",
      "In the meantime, you can browse our hardware specifications at https://tensorworks.com.au/hardware or read about our services at https://tensorworks.com.au/services.",
      "",
      "Regards,",
      "TensorWorks",
      "",
      "—",
      "TensorWorks Pty Ltd",
      "enquiries@tensorworks.com.au",
    ].join("\n"),
  });
}
