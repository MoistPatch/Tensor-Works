import { Resend } from "resend";
import { render } from "@react-email/components";
import { env } from "@/lib/env";
import type { RFQFull } from "@/lib/validations/rfq";
import { RFQNotification } from "@/emails/transactional/RFQNotification";
import { RFQAcknowledgement } from "@/emails/transactional/RFQAcknowledgement";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendRFQNotification(
  data: RFQFull,
  submissionId: string
): Promise<void> {
  const submittedAt = new Date().toLocaleString("en-AU", {
    timeZone: "Australia/Sydney",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const html = await render(
    RFQNotification({ data, submissionId, submittedAt })
  );

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to: env.NOTIFICATION_EMAIL,
    subject: `New RFQ — ${data.companyName} [${submissionId.slice(-8)}]`,
    html,
    text: [
      `New RFQ — ${data.companyName} (${submissionId})`,
      `Contact: ${data.contactName} <${data.email}>`,
      `Use case: ${data.useCase}`,
    ].join("\n"),
  });
}

export async function sendRFQAcknowledgement(data: RFQFull): Promise<void> {
  const html = await render(
    RFQAcknowledgement({
      contactName: data.contactName,
      companyName: data.companyName,
      siteUrl: env.NEXT_PUBLIC_SITE_URL,
    })
  );

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to: data.email,
    subject: "Your RFQ has been received — TensorWorks",
    html,
    text: [
      `Dear ${data.contactName},`,
      "",
      "Thank you for submitting a Request for Quote to TensorWorks.",
      "Our engineering team will respond within two business days.",
      "",
      `Hardware: ${env.NEXT_PUBLIC_SITE_URL}/hardware`,
      `Services: ${env.NEXT_PUBLIC_SITE_URL}/services`,
      "",
      "TensorWorks Pty Ltd — enquiries@tensorworks.com.au",
    ].join("\n"),
  });
}
