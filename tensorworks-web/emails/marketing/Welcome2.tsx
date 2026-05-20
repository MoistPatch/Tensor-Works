// Welcome 2 — Day 3
// Subject line (not sent, for reference): "Three days in — start here"

import {
  Heading,
  Hr,
  Link,
  Section,
  Text,
} from "@react-email/components";
import type React from "react";
import { BaseLayout } from "./BaseLayout";

interface Welcome2Props {
  unsubscribeUrl: string;
  siteUrl: string;
}

export function Welcome2({
  unsubscribeUrl,
  siteUrl,
}: Welcome2Props) {
  const resources = [
    {
      heading: "Understanding the GPU supply chain",
      description:
        "How GPUs move from wafer fabrication to your data centre — and why lead times are rarely what vendors quote.",
      slug: "understanding-gpu-supply-chain",
    },
    {
      heading: "How to write a GPU cluster RFQ",
      description:
        "A practical guide to specifying your requirements clearly enough that vendors can respond with accurate proposals.",
      slug: "how-to-write-gpu-cluster-rfq",
    },
  ];

  return (
    <BaseLayout
      subject="Three days in — start here"
      previewText="The two pieces our readers return to most."
      unsubscribeUrl={unsubscribeUrl}
      siteUrl={siteUrl}
    >
      <Section style={contentSectionStyle}>
        <Text style={greetingStyle}>Hi *|FNAME|*,</Text>

        <Text style={bodyTextStyle}>
          Three days in — here's what our readers find most useful.
        </Text>

        <Text style={bodyTextStyle}>
          We've published a lot, but two pieces consistently come up when readers
          tell us what helped them most:
        </Text>
      </Section>

      <Hr style={hrStyle} />

      {resources.map((resource, i) => (
        <Section key={i} style={resourceSectionStyle}>
          <Heading as="h3" style={resourceHeadingStyle}>
            <Link
              href={`${siteUrl}/insights/${resource.slug}`}
              style={resourceLinkStyle}
            >
              {resource.heading}
            </Link>
          </Heading>
          <Text style={resourceDescStyle}>{resource.description}</Text>
          <Link
            href={`${siteUrl}/insights/${resource.slug}`}
            style={readMoreLinkStyle}
          >
            Read →
          </Link>
          {i < resources.length - 1 && <Hr style={resourceDividerStyle} />}
        </Section>
      ))}

      <Hr style={hrStyle} />

      <Section style={contentSectionStyle}>
        <Text style={editorialNoteStyle}>
          A note on our process: content is generated with AI assistance and
          reviewed by our engineering team before publication. Everything we
          publish reflects a genuine technical perspective.
        </Text>

        <Text style={signOffStyle}>
          More next week.
          {"\n"}
          The TensorWorks team
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default Welcome2;

// Styles
const contentSectionStyle: React.CSSProperties = {
  padding: "28px 32px 16px",
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

const hrStyle: React.CSSProperties = {
  borderColor: "#e8edf3",
  margin: "0",
};

const resourceSectionStyle: React.CSSProperties = {
  padding: "24px 32px",
};

const resourceHeadingStyle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#333333",
  margin: "0 0 8px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const resourceLinkStyle: React.CSSProperties = {
  color: "#333333",
  textDecoration: "none",
};

const resourceDescStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#555555",
  lineHeight: "1.6",
  margin: "0 0 10px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const readMoreLinkStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#1F5C99",
  textDecoration: "underline",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const resourceDividerStyle: React.CSSProperties = {
  borderColor: "#f0f4f8",
  margin: "0",
};

const editorialNoteStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "#888",
  lineHeight: "1.6",
  margin: "0 0 20px",
  fontStyle: "italic",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const signOffStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#333333",
  margin: "4px 0 0",
  lineHeight: "1.7",
  fontFamily: "Arial, Helvetica, sans-serif",
  whiteSpace: "pre-line",
};
