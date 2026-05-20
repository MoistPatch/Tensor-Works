// Welcome 3 — Day 7
// Subject line (not sent, for reference): "One week in — a thought on GPU specs"

import {
  Hr,
  Link,
  Section,
  Text,
} from "@react-email/components";
import type React from "react";
import { BaseLayout } from "./BaseLayout";

interface Welcome3Props {
  unsubscribeUrl: string;
  siteUrl: string;
}

export function Welcome3({
  unsubscribeUrl,
  siteUrl,
}: Welcome3Props) {
  return (
    <BaseLayout
      subject="One week in — a thought on GPU specs"
      previewText="Getting GPU infrastructure specs right the first time matters more than most people expect."
      unsubscribeUrl={unsubscribeUrl}
      siteUrl={siteUrl}
    >
      <Section style={contentSectionStyle}>
        <Text style={greetingStyle}>Hi *|FNAME|*,</Text>

        <Text style={bodyTextStyle}>One week in. Here's the thing about GPU infrastructure decisions:</Text>

        <Text style={bodyTextStyle}>
          Most mistakes don't show up immediately. An under-specified cluster runs
          fine on your first workload, then hits a wall when the team scales up or
          shifts to a different model architecture. By that point, you're either
          paying for expensive retrofits or locked into hardware that no longer
          fits your requirements. The margin for error in GPU procurement is narrow
          — not because the technology is fragile, but because the decisions
          compound quickly.
        </Text>

        <Text style={bodyTextStyle}>
          Getting specs right at the outset means understanding not just current
          requirements but where your workloads are likely to go over a two-to-three
          year horizon. Memory bandwidth, interconnect topology, storage throughput —
          these matter differently depending on whether you're training, fine-tuning,
          or running inference at scale. The organisations that avoid costly
          corrections are the ones that take the time to specify clearly before they
          go to market.
        </Text>

        <Hr style={hrStyle} />

        <Text style={bodyTextStyle}>
          If you're currently evaluating or planning AI compute infrastructure,
          our RFQ process takes 5 minutes and we respond within two business days.
        </Text>

        {/* CTA button */}
        <Section style={ctaWrapStyle}>
          <Link href={`${siteUrl}/contact`} style={ctaButtonStyle}>
            Submit an RFQ →
          </Link>
        </Section>

        <Text style={noSellStyle}>
          No pressure if you're just following the space — the insights will keep
          coming either way.
        </Text>

        <Text style={signOffStyle}>
          Thanks for reading.
          {"\n"}
          The TensorWorks team
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default Welcome3;

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

const hrStyle: React.CSSProperties = {
  borderColor: "#e8edf3",
  margin: "20px 0",
};

const ctaWrapStyle: React.CSSProperties = {
  margin: "20px 0",
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

const noSellStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#777",
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
