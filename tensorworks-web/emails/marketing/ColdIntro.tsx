import {
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from "@react-email/components";
import type React from "react";
import { BaseLayout } from "./BaseLayout";

interface ColdIntroProps {
  subjectLine: string;
  previewText: string;
  firstName: string;
  roleTitle: string;
  organisation: string;
  consentNote: string;          // Why this contact is relevant (from subscriber.consentNote)
  featuredAnalysis: {
    title: string;
    slug: string;
    summary: string;
  };
  unsubscribeUrl: string;
  siteUrl: string;
}

export function ColdIntro({
  subjectLine,
  previewText,
  firstName,
  roleTitle,
  organisation,
  consentNote,
  featuredAnalysis,
  unsubscribeUrl,
  siteUrl,
}: ColdIntroProps) {
  const analysisUrl = `${siteUrl}/insights/${featuredAnalysis.slug}`;

  return (
    <BaseLayout
      subject={subjectLine}
      previewText={previewText}
      unsubscribeUrl={unsubscribeUrl}
      siteUrl={siteUrl}
    >
      <Section style={contentSectionStyle}>
        {/* Greeting — cold contact, use real name */}
        <Text style={greetingStyle}>Hi {firstName},</Text>

        {/* Paragraph 1: relevance */}
        <Text style={bodyTextStyle}>
          As {roleTitle} at {organisation}, you're likely evaluating or overseeing
          AI compute infrastructure — an area where specification decisions have
          outsized downstream consequences. TensorWorks works with organisations
          across Australia on exactly this problem.
        </Text>

        {/* Paragraph 2: share the analysis */}
        <Text style={bodyTextStyle}>
          We've just published{" "}
          <em>{featuredAnalysis.title}</em>, which covers {featuredAnalysis.summary.toLowerCase().replace(/\.$/, "")}. It's free to read:
        </Text>

        {/* CTA — plain text style, not button */}
        <Text style={plainCtaStyle}>
          <Link href={analysisUrl} style={plainCtaLinkStyle}>
            {analysisUrl}
          </Link>
        </Text>

        {/* Paragraph 3: single ask */}
        <Text style={bodyTextStyle}>
          Worth a 20-minute conversation about your infrastructure requirements?
        </Text>

        {/* Sign-off */}
        <Text style={signOffStyle}>
          Sam / TensorWorks
        </Text>
      </Section>

      <Hr style={hrStyle} />

      {/* Minimal footer for cold email */}
      <Section style={coldFooterSectionStyle}>
        <Text style={coldFooterTextStyle}>
          You're receiving this because {consentNote}. If you'd prefer not to hear from us:
        </Text>
        <Text style={coldFooterTextStyle}>
          <Link href={unsubscribeUrl} style={unsubscribeLinkStyle}>
            One-click unsubscribe
          </Link>
        </Text>
        <Text style={coldFooterLegalStyle}>
          TensorWorks Pty Ltd | ABN 84 544 119 830 | Bendigo, Victoria, Australia
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default ColdIntro;

// Styles
const contentSectionStyle: React.CSSProperties = {
  padding: "32px 32px 24px",
};

const greetingStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "#333333",
  margin: "0 0 18px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#444444",
  lineHeight: "1.7",
  margin: "0 0 16px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const plainCtaStyle: React.CSSProperties = {
  fontSize: "14px",
  margin: "0 0 20px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const plainCtaLinkStyle: React.CSSProperties = {
  color: "#1F5C99",
  textDecoration: "underline",
};

const signOffStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#333333",
  margin: "24px 0 0",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e8edf3",
  margin: "0",
};

const coldFooterSectionStyle: React.CSSProperties = {
  padding: "16px 32px 20px",
  backgroundColor: "#fafafa",
};

const coldFooterTextStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#888",
  margin: "0 0 6px",
  lineHeight: "1.5",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const unsubscribeLinkStyle: React.CSSProperties = {
  color: "#888",
  textDecoration: "underline",
};

const coldFooterLegalStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#aaa",
  margin: "10px 0 0",
  fontFamily: "Arial, Helvetica, sans-serif",
};
