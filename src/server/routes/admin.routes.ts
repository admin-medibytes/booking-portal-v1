import { Hono } from "hono";
import { type } from "arktype";
import { authMiddleware, requireAdmin } from "@/server/middleware/auth.middleware";
import { arktypeValidator } from "@/server/middleware/validate.middleware";
import { userService } from "@/server/services/user.service";
import { organizationService } from "@/server/services/organization.service";
import { logger } from "@/server/utils/logger";

const updateUserSchema = type({
  "firstName?": "string>=2",
  "lastName?": "string>=2",
  "phone?": "string",
  "jobTitle?": "string",
  "isActive?": "boolean",
});

const updateUserStatusSchema = type({
  isActive: "boolean",
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

const updateOrganizationSchema = type({
  "name?": "2<=string<=100",
  "logo?": "string",
  "contactEmail?": "string.email",
  "phone?": "string",
  "address?": {
    street: "string",
    city: "string",
    state: "string",
    zipCode: "string",
    country: "string",
  },
});

const checkSlugSchema = type({
  slug: "string",
});

const createTeamSchema = type({
  name: "string>=2",
  organizationId: "string",
});

const updateTeamSchema = type({
  name: "string>=2",
});

const app = new Hono()
  .use("*", authMiddleware)
  .use("*", requireAdmin)
  .post(
    "/users",
    arktypeValidator(
      "json",
      type({
        email: "string.email",
        firstName: type("string")
          .pipe((s) => s.trim())
          .to("string > 1"),
        lastName: type("string")
          .pipe((s) => s.trim())
          .to("string > 1"),
        "phone?": "string",
        "jobTitle?": "string",
        organizationId: "string",
        teamId: "string",
        role: "'referrer'|'specialist'|'admin'",
        sendEmailInvitation: "boolean",
        "acuityCalendarId?": "string",
      })
    ),
    async (c) => {
      const input = c.req.valid("json");
      const auth = c.get("auth");

      const user = await userService.createUserWithMembership(
        {
          ...input,
          createdBy: auth.user!.id,
        },
        c.req.raw.headers
      );

      logger.info("Admin created new user", {
        userId: user.id,
        createdBy: auth.user?.id,
        email: input.email,
        role: input.role,
      });

      return c.json({ user }, 201);
    }
  )
  .get(
    "/users",
    arktypeValidator(
      "query",
      type({
        "page?": "string.integer>=1",
        "limit?": "1<string.integer<=100",
        "search?": "string",
        "role?": "'referrer'|'specialist'|'admin'|'manager'|'team_lead'",
        "organizationId?": "string",
        "status?": "'active'|'inactive'",
      })
    ),
    async (c) => {
      const queryParams = c.req.valid("query");
      const auth = c.get("auth");

      const result = await userService.listUsersWithMemberships({
        ...queryParams,
        page: Number(queryParams.page) || 1,
        limit: Number(queryParams.limit) || 20,
      });

      logger.info("Admin listed users", {
        requestedBy: auth.user?.id,
        page: result.pagination.page,
        totalUsers: result.pagination.total,
      });

      return c.json(result);
    }
  )
  .get("/users/:id", async (c) => {
    const userId = c.req.param("id");
    const auth = c.get("auth");

    const user = await userService.getUserDetails(userId);

    logger.info("Admin viewed user details", {
      userId,
      viewedBy: auth.user?.id,
    });

    return c.json({ user });
  })
  .put("/users/:id", arktypeValidator("json", updateUserSchema), async (c) => {
    const userId = c.req.param("id");
    const input = c.req.valid("json");
    const auth = c.get("auth");

    const user = await userService.updateUser(userId, input);

    logger.info("Admin updated user", {
      userId,
      updatedBy: auth.user?.id,
      changes: Object.keys(input),
    });

    return c.json({ user });
  })
  .post("/users/:id/invite", async (c) => {
    const userId = c.req.param("id");
    const auth = c.get("auth");

    await userService.sendInvitationEmail(userId, auth.user!.id);

    logger.info("Admin sent invitation email", {
      userId,
      sentBy: auth.user?.id,
    });

    return c.json({ success: true });
  })
  .put("/users/:id/status", arktypeValidator("json", updateUserStatusSchema), async (c) => {
    const userId = c.req.param("id");
    const { isActive } = c.req.valid("json");
    const auth = c.get("auth");

    await userService.updateUserStatus(userId, isActive, auth.user!.id);

    logger.info("Admin updated user status", {
      userId,
      isActive,
      updatedBy: auth.user?.id,
    });

    return c.json({ success: true });
  })
  .get("/organizations/:orgId/teams", async (c) => {
    const orgId = c.req.param("orgId");

    const teams = await userService.getOrganizationTeams(orgId);

    return c.json({ teams });
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
  })

  .post(
    "/organizations",
    arktypeValidator(
      "json",
      type({
        name: "string>=2",
        slug: "string",
        "logo?": "string",
        "contactEmail?": "string.email",
        "phone?": "string",
        "address?": {
          street: "string",
          city: "string",
          state: "string",
          zipCode: "string",
          country: "string",
        },
      })
    ),
    async (c) => {
      const input = c.req.valid("json");
      const auth = c.get("auth");

      const organization = await organizationService.createOrganization(
        {
          ...input,
          createdBy: auth.user!.id,
        },
        c.req.raw.headers
      );

      logger.info("Admin created organization", {
        organizationId: organization.id,
        createdBy: auth.user?.id,
        name: input.name,
      });

      return c.json({ organization }, 201);
    }
  )

  .get(
    "/organizations",
    arktypeValidator(
      "query",
      type({
        "page?": "string.integer>=1",
        "limit?": "1<string.integer<=100",
        "search?": "string",
        "status?": "'active'|'inactive'",
      })
    ),
    async (c) => {
      const params = c.req.valid("query");
      const auth = c.get("auth");

      const result = await organizationService.listOrganizations(
        {
          ...params,
          page: Number(params.page) || 1,
          limit: Number(params.limit) || 20,
        },
        c.req.raw.headers
      );

      logger.info("Admin listed organizations", {
        requestedBy: auth.user?.id,
        page: result.pagination.page,
        total: result.pagination.total,
      });

      return c.json(result);
    }
  )

  .get("/organizations/:id", async (c) => {
    const orgId = c.req.param("id");
    const auth = c.get("auth");

    const organization = await organizationService.getOrganizationWithStats(
      orgId,
      c.req.raw.headers
    );

    logger.info("Admin viewed organization details", {
      organizationId: orgId,
      viewedBy: auth.user?.id,
    });

    return c.json({ organization });
  })

  .put("/organizations/:id", arktypeValidator("json", updateOrganizationSchema), async (c) => {
    const orgId = c.req.param("id");
    const input = c.req.valid("json");
    const auth = c.get("auth");

    const organization = await organizationService.updateOrganization(
      orgId,
      input,
      auth.user!.id,
      c.req.raw.headers
    );

    logger.info("Admin updated organization", {
      organizationId: orgId,
      updatedBy: auth.user?.id,
      changes: Object.keys(input),
    });

    return c.json({ organization });
  })

  .delete("/organizations/:id", async (c) => {
    const orgId = c.req.param("id");
    const auth = c.get("auth");

    await organizationService.deleteOrganization(orgId, auth.user!.id, c.req.raw.headers);

    logger.info("Admin deleted organization", {
      organizationId: orgId,
      deletedBy: auth.user?.id,
    });

    return c.json({ success: true });
  })

  .post("/organizations/check-slug", arktypeValidator("json", checkSlugSchema), async (c) => {
    const { slug } = c.req.valid("json");

    const available = await organizationService.checkSlugAvailability(slug, c.req.raw.headers);

    return c.json({ available });
  })

  .post("/organizations/:orgId/teams", arktypeValidator("json", createTeamSchema), async (c) => {
    const orgId = c.req.param("orgId");
    const { name } = c.req.valid("json");
    const auth = c.get("auth");

    const team = await organizationService.createTeam(
      {
        name,
        organizationId: orgId,
        createdBy: auth.user!.id,
      },
      c.req.raw.headers
    );

    logger.info("Admin created team", {
      teamId: team.id,
      organizationId: orgId,
      createdBy: auth.user?.id,
      name,
    });

    return c.json({ team }, 201);
  })

  .get("/organizations/:orgId/teams", async (c) => {
    const orgId = c.req.param("orgId");

    const teams = await organizationService.listTeams(orgId, c.req.raw.headers);

    return c.json({ teams });
  })

  .put("/teams/:teamId", arktypeValidator("json", updateTeamSchema), async (c) => {
    const teamId = c.req.param("teamId");
    const { name } = c.req.valid("json");
    const auth = c.get("auth");

    const team = await organizationService.updateTeam(
      teamId,
      name,
      auth.user!.id,
      c.req.raw.headers
    );

    logger.info("Admin updated team", {
      teamId,
      updatedBy: auth.user?.id,
      name,
    });

    return c.json({ team });
  })

  .delete("/teams/:teamId", async (c) => {
    const teamId = c.req.param("teamId");
    const auth = c.get("auth");

    await organizationService.deleteTeam(teamId, auth.user!.id, c.req.raw.headers);

    logger.info("Admin deleted team", {
      teamId,
      deletedBy: auth.user?.id,
    });

    return c.json({ success: true });
  });

export default app;
