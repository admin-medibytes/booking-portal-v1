import { Hono } from "hono";
import { type } from "arktype";
import { authMiddleware, requireAdmin } from "@/server/middleware/auth.middleware";
import { arktypeValidator } from "@/server/middleware/validate.middleware";
import { userService } from "@/server/services/user.service";
import { logger } from "@/server/utils/logger";

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

const inviteUserSchema = type({
  email: "string.email",
  role: "'referrer'|'specialist'",
  organizationId: "string",
  "teamId?": "string",
  "firstName?": "string",
  "lastName?": "string",
  "jobTitle?": "string",
});

const listInvitationsSchema = type({
  "organizationId?": "string",
  "status?": "'pending'|'accepted'|'rejected'|'expired'",
  "page?": "number>=1",
  "limit?": "1<number<=100",
});

const app = new Hono()
  .use("*", authMiddleware)
  .use("*", requireAdmin)
  .post("/users", arktypeValidator("json", createUserSchema), async (c) => {
    const input = c.req.valid("json");
    const auth = c.get("auth");

    const user = await userService.createUser(input);

    logger.info("Admin created new user", {
      userId: user.id,
      createdBy: auth.user?.id,
      email: input.email,
      role: input.role,
    });

    return c.json({ user }, 201);
  })
  .get("/users", arktypeValidator("query", listUsersSchema), async (c) => {
    const queryParams = c.req.valid("query");
    const auth = c.get("auth");

    const result = await userService.listUsers(queryParams);

    logger.info("Admin listed users", {
      requestedBy: auth.user?.id,
      page: result.page,
      totalUsers: result.total,
    });

    return c.json(result);
  })
  .post("/users/:id/resend-invitation", async (c) => {
    const userId = c.req.param("id");
    const auth = c.get("auth");

    await userService.resendInvitation(userId, auth.user!.id);

    logger.info("Admin resent invitation", {
      userId,
      resentBy: auth.user?.id,
    });

    return c.json({ success: true });
  })

  .post("/invite-user", arktypeValidator("json", inviteUserSchema), async (c) => {
    const input = c.req.valid("json");
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
  })

  .get("/invitations", arktypeValidator("query", listInvitationsSchema), async (c) => {
    const params = c.req.valid("query");

    const invitations = await userService.listInvitations({
      ...params,
      page: params.page || 1,
      limit: params.limit || 20,
    });

    return c.json(invitations);
  });

export default app;
