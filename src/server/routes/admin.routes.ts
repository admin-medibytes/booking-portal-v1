import { Hono } from "hono";
import { type } from "arktype";
import { authMiddleware, requireAdmin } from "@/server/middleware/auth.middleware";
import { validateMiddleware } from "@/server/middleware/validate.middleware";
import { userService } from "@/server/services/user.service";
import { logger } from "@/server/utils/logger";
import type { CreateUserInput, UserListParams } from "@/types/user";

const app = new Hono();

app.use("*", authMiddleware, requireAdmin);

const createUserSchema = type({
  email: "string.email",
  name: "string>=2",
  firstName: "string>=1",
  lastName: "string>=1",
  jobTitle: "string>=2",
  role: "'admin'|'user'",
  "organizationId?": "string",
  "teamId?": "string",
});

const listUsersSchema = type({
  "page?": "number>=1",
  "limit?": "1<number<=100",
  "search?": "string",
  "role?": "string",
  "organizationId?": "string",
});

app.post("/users", validateMiddleware(createUserSchema), async (c) => {
  const input = c.get("validatedData") as CreateUserInput;
  const auth = c.get("auth");

  const user = await userService.createUser(input);

  logger.info("Admin created new user", {
    userId: user.id,
    createdBy: auth.user?.id,
    email: input.email,
    role: input.role,
  });

  return c.json({ user }, 201);
});

app.get("/users", validateMiddleware(listUsersSchema, "query"), async (c) => {
  const params = c.get("validatedData") as UserListParams;
  const auth = c.get("auth");

  const result = await userService.listUsers(params);

  logger.info("Admin listed users", {
    requestedBy: auth.user?.id,
    page: result.page,
    totalUsers: result.total,
  });

  return c.json(result);
});

app.post("/users/:id/resend-invitation", async (c) => {
  const userId = c.req.param("id");
  const auth = c.get("auth");

  await userService.resendInvitation(userId, auth.user!.id);

  logger.info("Admin resent invitation", {
    userId,
    resentBy: auth.user?.id,
  });

  return c.json({ success: true });
});

const inviteUserSchema = type({
  email: "string.email",
  role: "'referrer'|'specialist'",
  organizationId: "string",
  "teamId?": "string",
  "firstName?": "string",
  "lastName?": "string",
  "jobTitle?": "string",
});

app.post("/invite-user", validateMiddleware(inviteUserSchema), async (c) => {
  const input = c.get("validatedData") as {
    email: string;
    role: "referrer" | "specialist";
    organizationId: string;
    teamId?: string;
    firstName?: string;
    lastName?: string;
    jobTitle?: string;
  };
  const auth = c.get("auth");

  const invitation = await userService.inviteUser({
    ...input,
    invitedBy: auth.user!,
  });

  logger.info("Admin sent user invitation", {
    invitedEmail: input.email,
    invitedBy: auth.user?.id,
    role: input.role,
    organizationId: input.organizationId,
  });

  return c.json({ invitation }, 201);
});

const listInvitationsSchema = type({
  "organizationId?": "string",
  "status?": "'pending'|'accepted'|'rejected'|'expired'",
  "page?": "number>=1",
  "limit?": "1<number<=100",
});

app.get("/invitations", validateMiddleware(listInvitationsSchema, "query"), async (c) => {
  const params = c.get("validatedData") as {
    organizationId?: string;
    status?: "pending" | "accepted" | "rejected" | "expired";
    page?: number;
    limit?: number;
  };

  const invitations = await userService.listInvitations({
    ...params,
    page: params.page || 1,
    limit: params.limit || 20,
  });

  return c.json(invitations);
});

export default app;
