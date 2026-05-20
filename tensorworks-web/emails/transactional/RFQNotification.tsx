import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from "@react-email/components";
import {
  organisationTypeLabels,
  budgetBracketLabels,
  timelineLabels,
  type RFQFull,
} from "@/lib/validations/rfq";

interface RFQNotificationProps {
  data: RFQFull;
  submissionId: string;
  submittedAt: string;
}

export function RFQNotification({
  data,
  submissionId,
  submittedAt,
}: RFQNotificationProps) {
  const constraints =
    data.procurementConstraints.length > 0
      ? data.procurementConstraints.join(", ")
      : "None";

  return (
    <Html lang="en">
      <Head />
      <Preview>
        New RFQ from {data.companyName} — {data.contactName}
      </Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Section style={headerStyle}>
            <Heading style={logoStyle}>TensorWorks</Heading>
            <Text style={subheadStyle}>New RFQ Submission</Text>
          </Section>

          <Section style={sectionStyle}>
            <Text style={metaStyle}>
              Submission ID: <strong>{submissionId}</strong> · {submittedAt}
            </Text>

            <Heading as="h2" style={h2Style}>Contact details</Heading>
            <Row>
              <Column style={labelCol}><Text style={label}>Company</Text></Column>
              <Column><Text style={value}>{data.companyName}{data.abn ? ` (ABN ${data.abn})` : ""}</Text></Column>
            </Row>
            <Row>
              <Column style={labelCol}><Text style={label}>Contact</Text></Column>
              <Column><Text style={value}>{data.contactName}, {data.role}</Text></Column>
            </Row>
            <Row>
              <Column style={labelCol}><Text style={label}>Email</Text></Column>
              <Column><Text style={value}>{data.email}</Text></Column>
            </Row>
            <Row>
              <Column style={labelCol}><Text style={label}>Phone</Text></Column>
              <Column><Text style={value}>{data.phone}</Text></Column>
            </Row>
            <Row>
              <Column style={labelCol}><Text style={label}>Org type</Text></Column>
              <Column><Text style={value}>{organisationTypeLabels[data.organisationType] ?? data.organisationType}</Text></Column>
            </Row>

            <Hr style={hrStyle} />

            <Heading as="h2" style={h2Style}>Requirements</Heading>
            <Row>
              <Column style={labelCol}><Text style={label}>Budget</Text></Column>
              <Column><Text style={value}>{budgetBracketLabels[data.budgetBracket] ?? data.budgetBracket}</Text></Column>
            </Row>
            <Row>
              <Column style={labelCol}><Text style={label}>Timeline</Text></Column>
              <Column><Text style={value}>{timelineLabels[data.timeline] ?? data.timeline}</Text></Column>
            </Row>
            <Row>
              <Column style={labelCol}><Text style={label}>Constraints</Text></Column>
              <Column><Text style={value}>{constraints}</Text></Column>
            </Row>

            <Text style={fieldLabel}>Use case</Text>
            <Text style={blockValue}>{data.useCase}</Text>

            {data.specifications && (
              <>
                <Text style={fieldLabel}>Technical specifications</Text>
                <Text style={blockValue}>{data.specifications}</Text>
              </>
            )}

            {data.referralSource && (
              <>
                <Hr style={hrStyle} />
                <Row>
                  <Column style={labelCol}><Text style={label}>Referral</Text></Column>
                  <Column><Text style={value}>{data.referralSource}</Text></Column>
                </Row>
              </>
            )}
          </Section>

          <Section style={footerStyle}>
            <Text style={footerText}>TensorWorks Pty Ltd · ABN 84 544 119 830</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default RFQNotification;

const bodyStyle = { backgroundColor: "#F5F8FB", fontFamily: "system-ui, -apple-system, sans-serif" };
const containerStyle = { maxWidth: "600px", margin: "0 auto", backgroundColor: "#ffffff", borderRadius: "8px", overflow: "hidden" as const };
const headerStyle = { backgroundColor: "#1F5C99", padding: "24px 32px" };
const logoStyle = { color: "#ffffff", fontSize: "20px", fontWeight: "700" as const, margin: "0 0 4px" };
const subheadStyle = { color: "#a8cce8", fontSize: "13px", margin: "0" };
const sectionStyle = { padding: "28px 32px" };
const metaStyle = { fontSize: "12px", color: "#999", margin: "0 0 20px" };
const h2Style = { fontSize: "14px", fontWeight: "600" as const, color: "#333", textTransform: "uppercase" as const, letterSpacing: "0.05em", margin: "20px 0 10px" };
const labelCol = { width: "120px" };
const label = { fontSize: "13px", color: "#999", margin: "2px 0" };
const value = { fontSize: "13px", color: "#333", margin: "2px 0" };
const fieldLabel = { fontSize: "13px", color: "#999", textTransform: "uppercase" as const, letterSpacing: "0.04em", margin: "20px 0 4px" };
const blockValue = { fontSize: "13px", color: "#333", backgroundColor: "#F5F8FB", padding: "12px", borderRadius: "4px", margin: "0 0 8px", lineHeight: "1.6" };
const hrStyle = { borderColor: "#e8edf3", margin: "16px 0" };
const footerStyle = { backgroundColor: "#F5F8FB", padding: "16px 32px" };
const footerText = { fontSize: "11px", color: "#999", margin: "0", textAlign: "center" as const };
