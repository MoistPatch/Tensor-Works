// Subject line (not sent, for reference): "Welcome to TensorWorks Insights"

import {
  Hr,
  Link,
  Section,
  Text,
} from "@react-email/components";
import type React from "react";
import { BaseLayout } from "./BaseLayout";

interface WelcomeProps {
  firstName?: string;
  unsubscribeUrl: string;
  siteUrl: string;
}

export function Welcome({
  firstName,
  unsubscribeUrl,
  siteUrl,
}: WelcomeProps) {
  return (
    <BaseLayout
      subject="Welcome to TensorWorks Insights"
      previewText="You're subscribed. Here's what to expect."
      unsubscribeUrl={unsubscribeUrl}
      siteUrl={siteUrl}
    >
      <Section style={contentSectionStyle}>
        <Text style={greetingStyle}>Hi *|FNAME|*,</Text>

        <Text style={bodyTextStyle}>
          Thanks for confirming your subscription. You're now part of TensorWorks Insights.
        </Text>

        <Text style={bodyTextStyle}>Here's what to expect:</Text>

        {/* What to expect */}
        <Section style={expectBoxStyle}>
          <Text style={expectItemStyle}>
            <strong style={expectLabelStyle}>Weekly digest, every Tuesday —</strong>{" "}
            A curated roundup of meaningful developments in AI compute: new hardware,
            supply chain movements, and market signals that matter.
          </Text>

          <Text style={expectItemStyle}>
            <strong style={expectLabelStyle}>Occasional deep analyses —</strong>{" "}
            Longer technical pieces on specific topics: GPU architectures, cluster
            configurations, procurement strategy, and more.
          </Text>

          <Text style={expectItemStyle}>
            <strong style={expectLabelStyle}>Practical, technical content —</strong>{" "}
            No vendor fluff. Content is written for people who need to make real
            infrastructure decisions.
          </Text>
        </Section>

        <Hr style={hrStyle} />

        <Text style={bodyTextStyle}>
          <strong>Here's where to start:</strong>{" "}
          Browse everything we've published at{" "}
          <Link href={`${siteUrl}/insights`} style={inlineLinkStyle}>
            tensorworks.com.au/insights
          </Link>
          .
        </Text>

        <Text style={signOffStyle}>
          Good to have you along.
          {"\n"}
          The TensorWorks team
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default Welcome;

// Styles
const contentSectionStyle: React.CSSProperties = {
  padding: "32px 32px 28px",
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

const expectBoxStyle: React.CSSProperties = {
  backgroundColor: "#F5F8FB",
  borderLeft: "3px solid #1F5C99",
  padding: "16px 20px",
  margin: "4px 0 20px",
  borderRadius: "0 4px 4px 0",
};

const expectItemStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#444444",
  lineHeight: "1.6",
  margin: "0 0 12px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const expectLabelStyle: React.CSSProperties = {
  color: "#333333",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e8edf3",
  margin: "20px 0",
};

const inlineLinkStyle: React.CSSProperties = {
  color: "#1F5C99",
  textDecoration: "underline",
};

const signOffStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#333333",
  margin: "24px 0 0",
  lineHeight: "1.7",
  fontFamily: "Arial, Helvetica, sans-serif",
  whiteSpace: "pre-line",
};
