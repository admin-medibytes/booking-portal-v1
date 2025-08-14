// Node.js compatible environment configuration for scripts
import dotenv from "dotenv";
import path from "path";

// Load .env file
dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

// Simple environment validation and access
export const scriptEnv = {
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/booking_portal",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "dev-secret-change-in-production",
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
} as const;

// Validate required env vars
const requiredEnvVars = ["DATABASE_URL", "BETTER_AUTH_SECRET"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  Warning: ${envVar} not set in environment`);
  }
}