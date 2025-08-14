import { env } from "@/lib/env";
import { logger } from "@/server/utils/logger";

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface OTPEmailData {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password";
}

export interface InvitationEmailData {
  email: string;
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  inviteLink: string;
  expiresAt: Date;
}

export interface PhoneOTPData {
  phoneNumber: string;
  code: string;
}

/**
 * Email service for sending transactional emails
 * TODO: Implement AWS SES integration
 */
export class EmailService {
  private fromEmail: string;

  constructor() {
    this.fromEmail = env.SES_FROM_EMAIL || "noreply@medibytes.com";
  }

  /**
   * Send OTP email for authentication
   */
  async sendOTPEmail(data: OTPEmailData): Promise<void> {
    const subject = this.getOTPSubject(data.type);
    const template = this.generateOTPTemplate(data);

    try {
      // TODO: Implement AWS SES sending
      logger.info("Sending OTP email", {
        to: data.email,
        type: data.type,
        subject,
      });

      await this.sendEmail({
        to: data.email,
        subject,
        html: template.html,
        text: template.text,
      });
    } catch (error) {
      logger.error("Failed to send OTP email", error as Error, {
        to: data.email,
        type: data.type,
      });
      throw error;
    }
  }

  /**
   * Send organization invitation email
   */
  async sendInvitationEmail(data: InvitationEmailData): Promise<void> {
    const subject = `You're invited to join ${data.organizationName}`;
    const template = this.generateInvitationTemplate(data);

    try {
      // TODO: Implement AWS SES sending
      logger.info("Sending invitation email", {
        to: data.email,
        organization: data.organizationName,
        invitedBy: data.inviterEmail,
      });

      await this.sendEmail({
        to: data.email,
        subject,
        html: template.html,
        text: template.text,
      });
    } catch (error) {
      logger.error("Failed to send invitation email", error as Error, {
        to: data.email,
        organization: data.organizationName,
      });
      throw error;
    }
  }

  /**
   * Send SMS OTP via AWS SNS or Twilio
   * TODO: Implement SMS provider integration
   */
  async sendPhoneOTP(data: PhoneOTPData): Promise<void> {
    try {
      logger.info("Sending SMS OTP", {
        phoneNumber: data.phoneNumber,
      });

      // TODO: Implement AWS SNS or Twilio integration
      console.log(`SMS OTP would be sent to ${data.phoneNumber}: ${data.code}`);
    } catch (error) {
      logger.error("Failed to send SMS OTP", error as Error, {
        phoneNumber: data.phoneNumber,
      });
      throw error;
    }
  }

  /**
   * Core email sending method
   * TODO: Implement AWS SES integration
   */
  private async sendEmail(template: EmailTemplate): Promise<void> {
    // For now, just log the email
    console.log("Email would be sent:", {
      from: this.fromEmail,
      to: template.to,
      subject: template.subject,
    });

    // TODO: Implement AWS SES
    // const command = new SendEmailCommand({
    //   Source: this.fromEmail,
    //   Destination: { ToAddresses: [template.to] },
    //   Message: {
    //     Subject: { Data: template.subject },
    //     Body: {
    //       Html: { Data: template.html },
    //       Text: template.text ? { Data: template.text } : undefined,
    //     },
    //   },
    // });
    // await sesClient.send(command);
  }

  private getOTPSubject(type: OTPEmailData["type"]): string {
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
  }

  private generateOTPTemplate(data: OTPEmailData): { html: string; text: string } {
    const action = this.getOTPAction(data.type);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${this.getOTPSubject(data.type)}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Medibytes Booking Portal</h2>
            <p>Hello,</p>
            <p>${action}</p>
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
              <h1 style="font-size: 32px; letter-spacing: 8px; margin: 0; color: #1f2937;">${data.otp}</h1>
            </div>
            <p>This code will expire in 5 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="font-size: 12px; color: #6b7280;">
              This is an automated message from Medibytes Booking Portal. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
Medibytes Booking Portal

Hello,

${action}

Your verification code is: ${data.otp}

This code will expire in 5 minutes.

If you didn't request this code, please ignore this email.

---
This is an automated message from Medibytes Booking Portal.
    `.trim();

    return { html, text };
  }

  private generateInvitationTemplate(data: InvitationEmailData): { html: string; text: string } {
    const expiryDate = new Date(data.expiresAt).toLocaleDateString();
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Invitation to join ${data.organizationName}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Medibytes Booking Portal</h2>
            <p>Hello,</p>
            <p><strong>${data.inviterName}</strong> (${data.inviterEmail}) has invited you to join <strong>${data.organizationName}</strong> on Medibytes Booking Portal.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${data.inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2563eb;">${data.inviteLink}</p>
            <p style="color: #dc2626; margin-top: 20px;">This invitation will expire on ${expiryDate}.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="font-size: 12px; color: #6b7280;">
              This is an automated message from Medibytes Booking Portal. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `;

    const text = `
Medibytes Booking Portal

Hello,

${data.inviterName} (${data.inviterEmail}) has invited you to join ${data.organizationName} on Medibytes Booking Portal.

Accept the invitation by clicking this link:
${data.inviteLink}

This invitation will expire on ${expiryDate}.

---
This is an automated message from Medibytes Booking Portal.
    `.trim();

    return { html, text };
  }

  private getOTPAction(type: OTPEmailData["type"]): string {
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
  }
}

// Export singleton instance
export const emailService = new EmailService();