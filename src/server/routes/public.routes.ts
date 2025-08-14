import { Hono } from "hono";
import { type } from "arktype";
import { validateMiddleware } from "@/server/middleware/validate.middleware";
import { userService } from "@/server/services/user.service";
import { logger } from "@/server/utils/logger";

const app = new Hono();

const acceptInvitationSchema = type({
  invitationId: "string",
  email: "string.email",
  password: "string>=8",
  firstName: "string>=1",
  lastName: "string>=1",
  jobTitle: "string>=2",
});

app.post("/accept-invitation", validateMiddleware(acceptInvitationSchema), async (c) => {
  const input = c.get("validatedData") as {
    invitationId: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  };

  const result = await userService.acceptInvitation({
    invitationId: input.invitationId,
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    jobTitle: input.jobTitle,
  });

  logger.info("Invitation accepted", {
    invitationId: input.invitationId,
    email: input.email,
    userId: result.userId,
  });

  return c.json({ success: true, userId: result.userId }, 201);
});

export default app;