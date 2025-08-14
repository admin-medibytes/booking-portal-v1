import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface OTPEmailProps {
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password";
}

const baseUrl = process.env.APP_URL || "https://medibytes.com";

export const OTPEmail = ({
  otp = "123456",
  type = "sign-in",
}: OTPEmailProps) => {
  const getSubject = () => {
    switch (type) {
      case "sign-in":
        return "Your sign-in code for Medibytes";
      case "email-verification":
        return "Verify your email for Medibytes";
      case "forget-password":
        return "Reset your password for Medibytes";
      default:
        return "Your verification code for Medibytes";
    }
  };

  const getAction = () => {
    switch (type) {
      case "sign-in":
        return "Use the code below to sign in to your account:";
      case "email-verification":
        return "Use the code below to verify your email address:";
      case "forget-password":
        return "Use the code below to reset your password:";
      default:
        return "Use the code below to continue:";
    }
  };

  const previewText = getSubject();

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
          <Heading style={h1}>Medibytes Booking Portal</Heading>
          <Text style={text}>Hello,</Text>
          <Text style={text}>{getAction()}</Text>
          <Section style={codeContainer}>
            <Text style={code}>{otp}</Text>
          </Section>
          <Text style={text}>This code will expire in 5 minutes.</Text>
          <Text style={text}>
            If you didn&apos;t request this code, please ignore this email.
          </Text>
          <Hr style={hr} />
          <Text style={footer}>
            This is an automated message from Medibytes Booking Portal. Please do not
            reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default OTPEmail;

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
  color: "#2563eb",
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

const codeContainer = {
  backgroundColor: "#f3f4f6",
  borderRadius: "8px",
  margin: "20px 0",
  padding: "20px",
  textAlign: "center" as const,
};

const code = {
  color: "#1f2937",
  fontSize: "32px",
  fontWeight: "700",
  letterSpacing: "8px",
  lineHeight: "40px",
  margin: "0",
};

const hr = {
  borderColor: "#e5e7eb",
  margin: "30px 0",
};

const footer = {
  color: "#6b7280",
  fontSize: "12px",
  lineHeight: "20px",
  margin: "20px 0 0",
};