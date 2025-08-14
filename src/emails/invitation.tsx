import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface InvitationEmailProps {
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  inviteLink: string;
  expiresAt: Date;
}

const baseUrl = process.env.APP_URL || "https://medibytes.com";

export const InvitationEmail = ({
  inviterName = "John Doe",
  inviterEmail = "john@example.com",
  organizationName = "Acme Corp",
  inviteLink = "https://medibytes.com/accept-invitation/123",
  expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
}: InvitationEmailProps) => {
  const previewText = `You're invited to join ${organizationName}`;
  const expiryDate = expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src={`${baseUrl}/logo.png`}
            width="170"
            height="50"
            alt="Medibytes"
            style={logo}
          />
          <Heading style={h1}>You&apos;re invited to join {organizationName}</Heading>
          <Text style={text}>
            <strong>{inviterName}</strong> ({inviterEmail}) has invited you to join{" "}
            <strong>{organizationName}</strong> on Medibytes Booking Portal.
          </Text>
          <Text style={text}>
            Click the button below to accept the invitation and create your account:
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={inviteLink}>
              Accept Invitation
            </Button>
          </Section>
          <Text style={text}>
            Or copy and paste this URL into your browser:{" "}
            <Link href={inviteLink} style={link}>
              {inviteLink}
            </Link>
          </Text>
          <Hr style={hr} />
          <Text style={warning}>
            This invitation will expire on {expiryDate}. If you didn&apos;t expect this
            invitation, you can safely ignore this email.
          </Text>
          <Text style={footer}>
            This is an automated message from Medibytes Booking Portal. Please do not
            reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default InvitationEmail;

const main = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: "0 auto",
  padding: "20px 0 48px",
  maxWidth: "560px",
};

const logo = {
  margin: "0 auto 40px",
  display: "block",
};

const h1 = {
  color: "#1f2937",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "40px",
  margin: "0 0 20px",
};

const text = {
  color: "#374151",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 10px",
};

const buttonContainer = {
  margin: "30px 0",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#2563eb",
  borderRadius: "6px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 24px",
};

const link = {
  color: "#2563eb",
  textDecoration: "underline",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "30px 0",
};

const warning = {
  color: "#dc2626",
  fontSize: "14px",
  lineHeight: "24px",
  margin: "0 0 10px",
};

const footer = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "20px",
  margin: "20px 0 0",
};