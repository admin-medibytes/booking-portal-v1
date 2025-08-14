import { env } from "@/lib/env";
import { logger } from "@/server/utils/logger";
import { render } from "@react-email/render";
import InvitationEmail from "@/emails/invitation";
import OTPEmail from "@/emails/otp";
import PasswordResetEmail from "@/emails/password-reset";

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

export interface PasswordResetEmailData {
  email: string;
  resetLink: string;
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

    try {
      const html = await render(OTPEmail({ otp: data.otp, type: data.type }));
      const text = await render(OTPEmail({ otp: data.otp, type: data.type }), {
        plainText: true,
      });

      logger.info("Sending OTP email", {
        to: data.email,
        type: data.type,
        subject,
      });

      await this.sendEmail({
        to: data.email,
        subject,
        html,
        text,
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

    try {
      const html = await render(
        InvitationEmail({
          inviterName: data.inviterName,
          inviterEmail: data.inviterEmail,
          organizationName: data.organizationName,
          inviteLink: data.inviteLink,
          expiresAt: data.expiresAt,
        })
      );
      const text = await render(
        InvitationEmail({
          inviterName: data.inviterName,
          inviterEmail: data.inviterEmail,
          organizationName: data.organizationName,
          inviteLink: data.inviteLink,
          expiresAt: data.expiresAt,
        }),
        { plainText: true }
      );

      logger.info("Sending invitation email", {
        to: data.email,
        organization: data.organizationName,
        invitedBy: data.inviterEmail,
      });

      await this.sendEmail({
        to: data.email,
        subject,
        html,
        text,
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

  async sendPasswordResetEmail(data: PasswordResetEmailData): Promise<void> {
    const html = await render(
      PasswordResetEmail({
        resetLink: data.resetLink,
        userEmail: data.email,
      })
    );

    const template: EmailTemplate = {
      to: data.email,
      subject: "Reset your Medibytes password",
      html,
    };

    await this.sendEmail(template);

    logger.info("Password reset email sent", {
      email: data.email,
    });
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
}

// Export singleton instance
export const emailService = new EmailService();
