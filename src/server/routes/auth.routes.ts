import { Hono } from "hono";
import { auth } from "@/lib/auth";

const app = new Hono();

/**
 * Mount Better Auth handler to handle all auth routes
 * This includes:
 * - Core auth routes: /sign-in, /sign-up, /sign-out, /session
 * - Admin plugin routes: /admin/*
 * - Organization plugin routes: /organization/*
 * - 2FA plugin routes: /two-factor/*
 * - Phone number plugin routes: /phone-number/*
 * - Email OTP plugin routes: /email-otp/*
 */
app.on(["POST", "GET"], "/*", async (c) => {
  return auth.handler(c.req.raw);
});

export default app;