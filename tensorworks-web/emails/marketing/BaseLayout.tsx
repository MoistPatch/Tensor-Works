import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type React from "react";

interface BaseLayoutProps {
  subject: string;
  previewText: string;
  children: React.ReactNode;
  unsubscribeUrl: string;
  siteUrl?: string;
  year?: number;
}

export function BaseLayout({
  previewText,
  children,
  unsubscribeUrl,
  siteUrl = "https://tensorworks.com.au",
  year = new Date().getFullYear(),
}: BaseLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerSectionStyle}>
            <Row>
              <Column style={headerAccentColStyle} />
              <Column style={headerContentColStyle}>
                <Heading style={logoStyle}>TensorWorks</Heading>
              </Column>
            </Row>
          </Section>

          {/* Content */}
          {children}

          {/* Footer */}
          <Hr style={hrStyle} />
          <Section style={footerSectionStyle}>
            <Text style={footerConsentStyle}>
              You're receiving this because you subscribed to TensorWorks Insights.
            </Text>
            <Text style={footerBusinessStyle}>
              TensorWorks Pty Ltd | ABN 84 544 119 830 | Bendigo, Victoria, Australia
            </Text>
            <Text style={footerCopyrightStyle}>
              © {year} TensorWorks Pty Ltd. All rights reserved.
            </Text>
            <Text style={footerLinksStyle}>
              <Link href={unsubscribeUrl} style={footerLinkStyle}>
                Unsubscribe
              </Link>
              {" | "}
              <Link href="*|UPDATE_PROFILE|*" style={footerLinkStyle}>
                Update preferences
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default BaseLayout;

// Styles
const bodyStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily: "Arial, Helvetica, sans-serif",
  margin: "0",
  padding: "0",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "600px",
  margin: "0 auto",
  backgroundColor: "#ffffff",
};

const headerSectionStyle: React.CSSProperties = {
  padding: "24px 32px",
  borderBottom: "1px solid #e8edf3",
};

const headerAccentColStyle: React.CSSProperties = {
  width: "4px",
  backgroundColor: "#1F5C99",
  borderRadius: "2px",
};

const headerContentColStyle: React.CSSProperties = {
  paddingLeft: "14px",
};

const logoStyle: React.CSSProperties = {
  color: "#1F5C99",
  fontSize: "22px",
  fontWeight: "700",
  margin: "0",
  fontFamily: "Arial, Helvetica, sans-serif",
  letterSpacing: "-0.5px",
};

const hrStyle: React.CSSProperties = {
  borderColor: "#e8edf3",
  margin: "0",
};

const footerSectionStyle: React.CSSProperties = {
  backgroundColor: "#F5F8FB",
  padding: "20px 32px 24px",
};

const footerConsentStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#777",
  margin: "0 0 6px",
  textAlign: "center",
  lineHeight: "1.5",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const footerBusinessStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#999",
  margin: "0 0 4px",
  textAlign: "center",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const footerCopyrightStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#999",
  margin: "0 0 10px",
  textAlign: "center",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const footerLinksStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#999",
  margin: "0",
  textAlign: "center",
  fontFamily: "Arial, Helvetica, sans-serif",
};

const footerLinkStyle: React.CSSProperties = {
  color: "#1F5C99",
  textDecoration: "underline",
};
