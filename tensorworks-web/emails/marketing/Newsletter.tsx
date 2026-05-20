import {
  Column,
  Heading,
  Hr,
  Link,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type React from "react";
import { BaseLayout } from "./BaseLayout";

interface NewsletterProps {
  subjectLine: string;
  previewText: string;
  weekEnding: string;           // e.g. "12 May 2026"
  segmentTag: string;
  introText: string;            // AI-generated segment-specific intro (1-2 paragraphs)
  featuredPost: {
    title: string;
    slug: string;
    summary: string;
    readingTimeMin: number;
    category: string;
  };
  dailyScans: Array<{
    title: string;
    slug: string;
    summary: string;
    publishedAt: string;
  }>;
  recentDeepAnalysis?: {
    title: string;
    slug: string;
    summary: string;
  };
  unsubscribeUrl: string;
  siteUrl: string;
}

export function Newsletter({
  subjectLine,
  previewText,
  weekEnding,
  segmentTag,
  introText,
  featuredPost,
  dailyScans,
  recentDeepAnalysis,
  unsubscribeUrl,
  siteUrl,
}: NewsletterProps) {
  const featuredUrl = `${siteUrl}/insights/${featuredPost.slug}`;

  return (
    <BaseLayout
      subject={subjectLine}
      previewText={previewText}
      unsubscribeUrl={unsubscribeUrl}
      siteUrl={siteUrl}
    >
      {/* Greeting & intro */}
      <Section style={contentSectionStyle}>
        <Text style={greetingStyle}>Hi *|FNAME|*,</Text>

        {introText.split("\n\n").map((paragraph, i) => (
          <Text key={i} style={bodyTextStyle}>
            {paragraph}
          </Text>
        ))}

        <Text style={weekEndingStyle}>Week ending {weekEnding}</Text>
      </Section>

      <Hr style={hrStyle} />

      {/* Featured article */}
      <Section style={contentSectionStyle}>
        <Text style={sectionLabelStyle}>This week's analysis</Text>

        <Heading as="h2" style={h2Style}>
          {featuredPost.title}
        </Heading>

        <Text style={bodyTextStyle}>{featuredPost.summary}</Text>

        <Row style={metaRowStyle}>
          <Column>
            <Text style={categoryBadgeStyle}>{featuredPost.category}</Text>
          </Column>
          <Column>
            <Text style={readTimeStyle}>{featuredPost.readingTimeMin} min read</Text>
          </Column>
        </Row>

        <Section style={ctaWrapStyle}>
          <Link href={featuredUrl} style={ctaButtonStyle}>
            Read the full analysis →
          </Link>
        </Section>
      </Section>

      {/* Daily scans */}
      {dailyScans.length > 0 && (
        <>
          <Hr style={hrStyle} />
          <Section style={contentSectionStyle}>
            <Heading as="h3" style={h3Style}>Also this week</Heading>

            {dailyScans.map((scan, i) => (
              <Section key={i} style={scanItemStyle}>
                <Link href={`${siteUrl}/insights/${scan.slug}`} style={scanTitleLinkStyle}>
                  {scan.title}
                </Link>
                <Text style={scanDateStyle}>{scan.publishedAt}</Text>
                <Text style={scanSummaryStyle}>{scan.summary}</Text>
              </Section>
            ))}
          </Section>
        </>
      )}

      {/* Recent deep analysis */}
      {recentDeepAnalysis && (
        <>
          <Hr style={hrStyle} />
          <Section style={contentSectionStyle}>
            <Text style={sectionLabelStyle}>Recent deep analysis</Text>

            <Heading as="h3" style={h3Style}>
              {recentDeepAnalysis.title}
            </Heading>

            <Text style={bodyTextStyle}>{recentDeepAnalysis.summary}</Text>

            <Link
              href={`${siteUrl}/insights/${recentDeepAnalysis.slug}`}
              style={inlineLinkStyle}
            >
              Read the analysis →
            </Link>
          </Section>
        </>
      )}

      {/* Soft CTA */}
      <Hr style={hrStyle} />
      <Section style={contentSectionStyle}>
        <Text style={softCtaStyle}>
          Have a question about AI hardware? Reply to this email or{" "}
          <Link href={`${siteUrl}/contact`} style={inlineLinkStyle}>
            submit an RFQ
          </Link>
          .
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default Newsletter;

// Styles
const contentSectionStyle: React.CSSProperties = {
  padding: "28px 32px",
};

const greetingStyle: React.CSSProperties = {
  fontSize: "15px",
  color: "#333333",
  margin: "0 0 16px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const bodyTextStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#444444",
  lineHeight: "1.7",
  margin: "0 0 14px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const weekEndingStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  margin: "4px 0 0",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e8edf3",
  margin: "0",
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: "700",
  color: "#1F5C99",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "0 0 10px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const h2Style: React.CSSProperties = {
  fontSize: "20px",
  fontWeight: "700",
  color: "#333333",
  margin: "0 0 12px",
  lineHeight: "1.3",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const h3Style: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#333333",
  margin: "0 0 14px",
  lineHeight: "1.3",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const metaRowStyle: React.CSSProperties = {
  margin: "12px 0 16px",
};

const categoryBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#F5F8FB",
  color: "#1F5C99",
  fontSize: "11px",
  fontWeight: "600",
  padding: "3px 8px",
  borderRadius: "3px",
  border: "1px solid #d0e4f4",
  margin: "0",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const readTimeStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#999",
  margin: "0",
  textAlign: "right",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const ctaWrapStyle: React.CSSProperties = {
  margin: "4px 0 0",
};

const ctaButtonStyle: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#1F5C99",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "600",
  padding: "11px 22px",
  borderRadius: "5px",
  textDecoration: "none",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const scanItemStyle: React.CSSProperties = {
  marginBottom: "18px",
  paddingBottom: "18px",
  borderBottom: "1px solid #f0f4f8",
};

const scanTitleLinkStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#1F5C99",
  textDecoration: "none",
  display: "block",
  marginBottom: "3px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const scanDateStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#aaa",
  margin: "0 0 5px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const scanSummaryStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#555",
  lineHeight: "1.6",
  margin: "0",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const inlineLinkStyle: React.CSSProperties = {
  color: "#1F5C99",
  textDecoration: "underline",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const softCtaStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#555",
  lineHeight: "1.6",
  margin: "0",
  fontFamily: "Arial, Helvetica, sans-serif",
};
