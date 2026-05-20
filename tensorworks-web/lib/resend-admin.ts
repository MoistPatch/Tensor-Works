import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendMagicLink(email: string, token: string): Promise<void> {
  const baseUrl = env.NEXT_PUBLIC_SITE_URL;
  const link = `${baseUrl}/api/admin/auth?token=${token}`;

  await resend.emails.send({
    from: env.FROM_EMAIL,
    to: email,
    subject: "TensorWorks Admin — Sign in link",
    text: [
      "You requested a sign-in link for the TensorWorks admin panel.",
      "",
      `Sign in: ${link}`,
      "",
      "This link expires in 15 minutes. If you did not request this, ignore this email.",
    ].join("\n"),
  });
}
