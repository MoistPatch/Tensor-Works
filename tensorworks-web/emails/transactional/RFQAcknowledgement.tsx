import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface RFQAcknowledgementProps {
  contactName: string;
  companyName: string;
  siteUrl: string;
}

export function RFQAcknowledgement({
  contactName,
  companyName,
  siteUrl,
}: RFQAcknowledgementProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your RFQ has been received — TensorWorks will respond within two business days.</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Heading style={logoStyle}>TensorWorks</Heading>
          </Section>

          <Section style={sectionStyle}>
            <Heading as="h1" style={h1Style}>Request received</Heading>

            <Text style={bodyText}>Dear {contactName},</Text>

            <Text style={bodyText}>
              Thank you for submitting a Request for Quote on behalf of{" "}
              <strong>{companyName}</strong>.
            </Text>

            <Text style={bodyText}>
              Our engineering team will review your requirements and respond with a
              scoped proposal within <strong>two business days</strong>. If we need
              any clarification before preparing the proposal, we will reach out on
              the contact details you provided.
            </Text>

            <Section style={nextStepsBox}>
              <Text style={nextStepsHeading}>What happens next</Text>
              {[
                "We review your requirements and assess fit",
                "Our engineering team prepares a configuration recommendation",
                "We respond with a scoped proposal",
                "Scoping call to walk through the proposal if needed",
                "Statement of Work agreed before any commitment",
              ].map((step, i) => (
                <Text key={i} style={stepText}>
                  <span style={stepNum}>{i + 1}</span> {step}
                </Text>
              ))}
            </Section>

            <Hr style={hrStyle} />

            <Text style={bodyText}>
              In the meantime, you can browse our hardware specifications or read
              about our services:
            </Text>

            <Section style={buttonRow}>
              <Button href={`${siteUrl}/hardware`} style={btnPrimary}>
                Browse hardware
              </Button>
              <Button href={`${siteUrl}/services`} style={btnSecondary}>
                Our services
              </Button>
            </Section>
          </Section>

          <Section style={footerStyle}>
            <Text style={footerText}>
              TensorWorks Pty Ltd · ABN 84 544 119 830
            </Text>
            <Text style={footerText}>
              enquiries@tensorworks.com.au
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default RFQAcknowledgement;

const bodyStyle = { backgroundColor: "#F5F8FB", fontFamily: "system-ui, -apple-system, sans-serif" };
const containerStyle = { maxWidth: "600px", margin: "0 auto", backgroundColor: "#ffffff", borderRadius: "8px", overflow: "hidden" as const };
const headerStyle = { backgroundColor: "#1F5C99", padding: "24px 32px" };
const logoStyle = { color: "#ffffff", fontSize: "20px", fontWeight: "700" as const, margin: "0" };
const sectionStyle = { padding: "32px 32px 24px" };
const h1Style = { fontSize: "22px", fontWeight: "700" as const, color: "#1F5C99", margin: "0 0 20px" };
const bodyText = { fontSize: "14px", color: "#444", lineHeight: "1.7", margin: "0 0 14px" };
const nextStepsBox = { backgroundColor: "#F5F8FB", borderRadius: "6px", padding: "16px 20px", margin: "20px 0" };
const nextStepsHeading = { fontSize: "11px", fontWeight: "600" as const, color: "#999", textTransform: "uppercase" as const, letterSpacing: "0.06em", margin: "0 0 12px" };
const stepText = { fontSize: "13px", color: "#444", margin: "0 0 8px", lineHeight: "1.5" };
const stepNum = { display: "inline-block" as const, backgroundColor: "#1F5C99", color: "#ffffff", borderRadius: "50%", width: "18px", height: "18px", textAlign: "center" as const, fontSize: "11px", lineHeight: "18px", marginRight: "8px", fontWeight: "600" as const };
const hrStyle = { borderColor: "#e8edf3", margin: "20px 0" };
const buttonRow = { margin: "16px 0" };
const btnPrimary = { backgroundColor: "#1F5C99", color: "#ffffff", padding: "10px 20px", borderRadius: "6px", fontSize: "13px", fontWeight: "600" as const, textDecoration: "none", marginRight: "12px", display: "inline-block" as const };
const btnSecondary = { backgroundColor: "#ffffff", color: "#1F5C99", padding: "10px 20px", borderRadius: "6px", fontSize: "13px", fontWeight: "600" as const, textDecoration: "none", border: "1px solid #1F5C99", display: "inline-block" as const };
const footerStyle = { backgroundColor: "#F5F8FB", padding: "16px 32px", borderTop: "1px solid #e8edf3" };
const footerText = { fontSize: "11px", color: "#999", margin: "2px 0", textAlign: "center" as const };
