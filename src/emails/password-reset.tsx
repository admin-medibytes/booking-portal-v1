import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface PasswordResetEmailProps {
  resetLink: string;
  userEmail: string;
}

export const PasswordResetEmail = ({
  resetLink,
  userEmail,
}: PasswordResetEmailProps) => {
  const previewText = `Reset your Medibytes password`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>
            Hi there,
          </Text>
          <Text style={text}>
            We received a request to reset the password for your Medibytes account
            associated with {userEmail}.
          </Text>
          <Text style={text}>
            Click the button below to reset your password. This link will expire
            in 1 hour.
          </Text>
          <Section style={buttonContainer}>
            <Button style={button} href={resetLink}>
              Reset Password
            </Button>
          </Section>
          <Text style={text}>
            If you didn&apos;t request this password reset, you can safely ignore this
            email. Your password won&apos;t be changed.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            If the button above doesn&apos;t work, copy and paste this link into your
            browser:
          </Text>
          <Link href={resetLink} style={link}>
            {resetLink}
          </Link>
          <Text style={footer}>
            © {new Date().getFullYear()} Medibytes. All rights reserved.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

PasswordResetEmail.PreviewProps = {
  resetLink: "https://medibytes.com/reset-password?token=abc123",
  userEmail: "user@example.com",
} as PasswordResetEmailProps;

export default PasswordResetEmail;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "600",
  lineHeight: "40px",
  margin: "0 0 20px",
  padding: "0 48px",
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 10px 0",
  padding: "0 48px",
};

const buttonContainer = {
  padding: "27px 48px",
};

const button = {
  backgroundColor: "#3b82f6",
  borderRadius: "8px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "600",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 20px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 48px",
};

const footer = {
  color: "#8898aa",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0",
  padding: "0 48px",
};

const link = {
  color: "#3b82f6",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 10px 0",
  padding: "0 48px",
  textDecoration: "underline",
};