// Subject line (not sent, for reference): "Should we keep sending?"

import {
  Hr,
  Link,
  Section,
  Text,
} from "@react-email/components";
import type React from "react";
import { BaseLayout } from "./BaseLayout";

interface ReengagementProps {
  firstName?: string;
  unsubscribeUrl: string;
  renewUrl: string;   // Link to API endpoint that updates lastEngagedAt
  siteUrl: string;
}

export function Reengagement({
  firstName,
  unsubscribeUrl,
  renewUrl,
  siteUrl,
}: ReengagementProps) {
  return (
    <BaseLayout
      subject="Should we keep sending?"
      previewText="A quick check-in — no action needed to stay subscribed."
      unsubscribeUrl={unsubscribeUrl}
      siteUrl={siteUrl}
    >
      <Section style={contentSectionStyle}>
        <Text style={greetingStyle}>Hi *|FNAME|*,</Text>

        <Text style={bodyTextStyle}>
          We noticed you haven't opened our recent issues.
        </Text>

        <Text style={bodyTextStyle}>
          If you'd still like to receive TensorWorks Insights, no action needed —
          we'll keep sending.
        </Text>

        <Text style={bodyTextStyle}>
          If not, you can unsubscribe in one click below.
        </Text>

        <Hr style={hrStyle} />

        {/* Two text-style links */}
        <Text style={actionLinkWrapStyle}>
          <Link href={renewUrl} style={keepSubscribedLinkStyle}>
            Keep me subscribed
          </Link>
        </Text>

        <Text style={actionLinkWrapStyle}>
          <Link href={unsubscribeUrl} style={unsubscribeLinkStyle}>
            Unsubscribe
          </Link>
        </Text>

        <Hr style={hrStyle} />

        <Text style={closingStyle}>Either way — no hard feelings.</Text>

        <Text style={signOffStyle}>
          The TensorWorks team
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default Reengagement;

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
  margin: "0 0 12px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e8edf3",
  margin: "20px 0",
};

const actionLinkWrapStyle: React.CSSProperties = {
  fontSize: "14px",
  margin: "0 0 10px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const keepSubscribedLinkStyle: React.CSSProperties = {
  color: "#1F5C99",
  textDecoration: "underline",
};

const unsubscribeLinkStyle: React.CSSProperties = {
  color: "#888",
  textDecoration: "underline",
};

const closingStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#555",
  margin: "0 0 16px",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const signOffStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#333333",
  margin: "0",
  fontFamily: "Arial, Helvetica, sans-serif",
};
