import { Resend } from "resend";
import { env } from "@/lib/env";
import { ReactNode } from "react";

// Initialize Resend with API key
const resend = new Resend(env.RESEND_API_KEY);

export interface SendEmailProps {
  from: string;
  to: string;
  subject: string;
  body: ReactNode;
}

export async function sendEmail({ from, to, subject, body }: SendEmailProps) {
  const result = await resend.emails.send({ from, to, subject, react: body });

  if (result.error) {
    console.log(result.error);
    throw new Error(`Failed to send email: ${subject}`);
  }
}
