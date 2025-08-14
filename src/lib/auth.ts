import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/server/db";
import { twoFactor, phoneNumber, emailOTP, admin, organization } from "better-auth/plugins";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  appName: "booking-portal",
  plugins: [
    organization(),
    admin(),
    emailOTP({
      async sendVerificationOTP() {
        // Send email with OTP
        // TODO: Implement OTP sending logic
      },
    }),
    phoneNumber(),
    twoFactor(),
  ],
});
