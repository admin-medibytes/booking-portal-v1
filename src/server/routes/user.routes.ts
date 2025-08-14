import { Hono } from "hono";
import { type } from "arktype";
import { db } from "@/server/db";
import { users, accounts } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "@/lib/crypto";
import { logger } from "@/server/utils/logger";
import { authMiddleware, requireAuth } from "@/server/middleware/auth.middleware";
import { validateMiddleware } from "@/server/middleware/validate.middleware";

const app = new Hono();

// Apply auth middleware to all routes
app.use("*", authMiddleware);
app.use("*", requireAuth);

const setInitialPasswordSchema = type({
  newPassword: "string>=8",
});

// Set initial password for first-time users
app.post(
  "/set-initial-password",
  validateMiddleware(setInitialPasswordSchema),
  async (c) => {
    const auth = c.get("auth");
    const user = auth.user;
    const { newPassword } = c.get("validatedData") as { newPassword: string };

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Check if user is in first-time login state (no image set)
    if (user.image && user.image !== "initialized") {
      return c.json({ error: "Password already initialized" }, 400);
    }

    try {
      // Hash the new password using the same function as Better Auth
      const hashedPassword = await hashPassword(newPassword);

      // Update the user's password in the accounts table
      await db
        .update(accounts)
        .set({
          password: hashedPassword,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(accounts.userId, user.id),
            eq(accounts.providerId, "credential")
          )
        );

      // Mark user as initialized
      await db
        .update(users)
        .set({
          image: "initialized",
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      logger.info("Initial password set successfully", {
        userId: user.id,
        email: user.email,
      });

      return c.json({ success: true, message: "Password set successfully" });
    } catch (error) {
      logger.error("Failed to set initial password", error as Error);
      return c.json({ error: "Failed to set password" }, 500);
    }
  }
);

export default app;