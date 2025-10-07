import { Hono } from "hono";
import { type } from "arktype";
import { authMiddleware, requireAdmin } from "@/server/middleware/auth.middleware";
import { arktypeValidator } from "@/server/middleware/validate.middleware";
import { userService } from "@/server/services/user.service";
import { organizationService } from "@/server/services/organization.service";
import { specialistService } from "@/server/services/specialist.service";
import { acuityService } from "@/server/services/acuity.service";
import { appFormsService } from "@/server/services/appForms.service";
import { logger } from "@/server/utils/logger";
import { db } from "@/server/db";
import {
  acuityAppointmentTypes,
  acuityForms,
  acuityFormsFields,
  acuityAppointmentTypeForms,
} from "@/server/db/schema/acuity";
import { specialists, specialistAppointmentTypes } from "@/server/db/schema/specialists";
import { eq, sql, asc } from "drizzle-orm";

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
        "acuityCalendarId?": "number",
        "slug?": "string",
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
  })

  // Specialists routes
  .get("/specialists", async (c) => {
    const auth = c.get("auth");
    const adminUser = auth.user;

    if (!adminUser) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const includeInactive = c.req.query("includeInactive") === "true";

    const specialists = await specialistService.getAdminSpecialistList(adminUser.id, {
      includeInactive,
    });

    return c.json({
      success: true,
      data: specialists,
    });
  })

  // Get specialist appointment types
  .get("/specialists/:id/appointment-types", async (c) => {
    const specialistId = c.req.param("id");

    try {
      const appointmentTypes = await db
        .select({
          specialistId: specialistAppointmentTypes.specialistId,
          appointmentTypeId: specialistAppointmentTypes.appointmentTypeId,
          enabled: specialistAppointmentTypes.enabled,
          appointmentMode: specialistAppointmentTypes.appointmentMode,
          customDisplayName: specialistAppointmentTypes.customDisplayName,
          customDescription: specialistAppointmentTypes.customDescription,
          customPrice: specialistAppointmentTypes.customPrice,
          notes: specialistAppointmentTypes.notes,
          appointmentType: {
            id: acuityAppointmentTypes.id,
            name: acuityAppointmentTypes.name,
            description: acuityAppointmentTypes.description,
            duration: acuityAppointmentTypes.duration,
            price: acuityAppointmentTypes.price,
            category: acuityAppointmentTypes.category,
            active: acuityAppointmentTypes.active,
          },
        })
        .from(specialistAppointmentTypes)
        .leftJoin(
          acuityAppointmentTypes,
          eq(specialistAppointmentTypes.appointmentTypeId, acuityAppointmentTypes.id)
        )
        .where(eq(specialistAppointmentTypes.specialistId, specialistId));

      return c.json({
        success: true,
        data: appointmentTypes,
      });
    } catch (error) {
      logger.error("Failed to get specialist appointment types", error as Error, { specialistId });
      return c.json(
        {
          success: false,
          error: "Failed to get appointment types",
        },
        500
      );
    }
  })

  // Update specialist appointment types
  .put(
    "/specialists/:id/appointment-types",
    arktypeValidator(
      "json",
      type({
        appointmentTypes: [
          {
            id: "number",
            mode: "'in-person'|'telehealth'",
          },
          "[]",
        ],
      })
    ),
    async (c) => {
      const specialistId = c.req.param("id");
      const { appointmentTypes } = c.req.valid("json");

      try {
        // Use a transaction to update all appointment types
        await db.transaction(async (tx) => {
          // Verify specialist exists
          const [specialist] = await tx
            .select({ id: specialists.id })
            .from(specialists)
            .where(eq(specialists.id, specialistId));

          if (!specialist) {
            throw new Error("Specialist not found");
          }

          // Delete existing associations
          await tx
            .delete(specialistAppointmentTypes)
            .where(eq(specialistAppointmentTypes.specialistId, specialistId));

          // Then, insert new associations
          if (appointmentTypes.length > 0) {
            const newAssociations = appointmentTypes.map((type) => ({
              specialistId,
              appointmentTypeId: type.id,
              enabled: true,
              appointmentMode: type.mode,
            }));

            await tx.insert(specialistAppointmentTypes).values(newAssociations);
          }
        });

        logger.info("Updated specialist appointment types", {
          specialistId,
          count: appointmentTypes.length,
        });

        return c.json({
          success: true,
          message: "Appointment types updated successfully",
        });
      } catch (error) {
        logger.error("Failed to update specialist appointment types", error as Error, {
          specialistId,
        });
        return c.json(
          {
            success: false,
            error: "Failed to update appointment types",
          },
          500
        );
      }
    }
  )

  // Appointment Types sync - Admin only
  .post("/specialists/:id/appointment-types/sync", async (c) => {
    const specialistId = c.req.param("id");
    const auth = c.get("auth");
    const adminUser = auth.user;

    try {
      // Fetch appointment types from Acuity
      const appointmentTypes = await acuityService.getAppointmentTypes();

      logger.info("Admin synced appointment types from Acuity", {
        specialistId,
        syncedBy: adminUser?.id,
        count: appointmentTypes.length,
      });

      return c.json({
        success: true,
        count: appointmentTypes.length,
        appointmentTypes,
      });
    } catch (error) {
      logger.error("Failed to sync appointment types from Acuity", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to sync appointment types",
        },
        500
      );
    }
  })

  // Acuity Integration routes
  // Get appointment types from database
  .get("/integration/acuity/appointment-types", async (c) => {
    try {
      // First, get the appointment types from the database
      const appointmentTypesData = await db
        .select({
          id: acuityAppointmentTypes.id,
          name: acuityAppointmentTypes.name,
          duration: acuityAppointmentTypes.duration,
          price: acuityAppointmentTypes.price,
          category: acuityAppointmentTypes.category,
          active: acuityAppointmentTypes.active,
          lastSyncedAt: acuityAppointmentTypes.lastSyncedAt,
        })
        .from(acuityAppointmentTypes)
        .orderBy(acuityAppointmentTypes.name);

      // Then, get which appointment types are linked to specialists
      const linkedTypes = await db
        .select({
          appointmentTypeId: specialistAppointmentTypes.appointmentTypeId,
        })
        .from(specialistAppointmentTypes)
        .groupBy(specialistAppointmentTypes.appointmentTypeId);

      // Get form counts for each appointment type
      const formCounts = await db
        .select({
          appointmentTypeId: acuityAppointmentTypeForms.appointmentTypeId,
          count: sql<number>`count(*)::int`,
        })
        .from(acuityAppointmentTypeForms)
        .groupBy(acuityAppointmentTypeForms.appointmentTypeId);

      // Create lookup maps
      const linkedTypeIds = new Set(linkedTypes.map((item) => item.appointmentTypeId));

      const formCountMap = new Map(formCounts.map((item) => [item.appointmentTypeId, item.count]));

      // Add the isLinked flag and formCount to each appointment type
      const appointmentTypes = appointmentTypesData.map((type) => ({
        ...type,
        isLinked: linkedTypeIds.has(type.id),
        formCount: formCountMap.get(type.id) || 0,
      }));

      return c.json({
        success: true,
        data: appointmentTypes,
      });
    } catch (error) {
      logger.error("Failed to fetch appointment types from database", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to fetch appointment types",
        },
        500
      );
    }
  })

  // Preview sync - compare Acuity with database
  .post("/integration/acuity/appointment-types/preview", async (c) => {
    const auth = c.get("auth");
    const adminUser = auth.user;

    try {
      // Fetch from Acuity
      const acuityTypes = await acuityService.getAppointmentTypes();

      // Fetch existing appointment types from database
      const existingTypes = await db.select().from(acuityAppointmentTypes);

      // Fetch available forms from database
      const availableForms = await db.select({ id: acuityForms.id }).from(acuityForms);

      const availableFormIds = availableForms.map((f) => f.id);

      // Categorize appointment types
      const newTypes = acuityTypes.filter((at) => !existingTypes.find((et) => et.id === at.id));

      const updatedTypes = acuityTypes.filter((at) => existingTypes.find((et) => et.id === at.id));

      // Get appointment types that have forms linked via the join table
      const appointmentTypesWithForms = await db
        .select({
          appointmentTypeId: acuityAppointmentTypeForms.appointmentTypeId,
          formIds: sql<number[]>`array_agg(${acuityAppointmentTypeForms.formId})`,
        })
        .from(acuityAppointmentTypeForms)
        .groupBy(acuityAppointmentTypeForms.appointmentTypeId);

      // Create a map for quick lookup
      const appointmentTypeFormsMap = new Map(
        appointmentTypesWithForms.map((item) => [item.appointmentTypeId, item.formIds])
      );

      // Check for appointment types with forms (those that exist in the join table)
      const typesWithForms = acuityTypes.filter((at) => appointmentTypeFormsMap.has(at.id));

      // Find types with missing forms (forms that are linked but not yet synced to database)
      const typesWithMissingForms = typesWithForms.filter((at) => {
        const linkedFormIds = appointmentTypeFormsMap.get(at.id) || [];
        return linkedFormIds.some((formId: number) => !availableFormIds.includes(formId));
      });

      logger.info("Admin previewed appointment types sync", {
        previewedBy: adminUser?.id,
        totalTypes: acuityTypes.length,
        newTypes: newTypes.length,
        updatedTypes: updatedTypes.length,
        typesWithMissingForms: typesWithMissingForms.length,
      });

      return c.json({
        success: true,
        acuityTypes: acuityTypes.map((at) => ({
          id: at.id,
          name: at.name,
          duration: at.duration,
          category: at.category || "",
          formIds: appointmentTypeFormsMap.get(at.id) || [],
        })),
        existingTypes,
        newTypes: newTypes.map((at) => ({
          id: at.id,
          name: at.name,
          duration: at.duration,
          category: at.category || "",
          formIds: appointmentTypeFormsMap.get(at.id) || [],
        })),
        updatedTypes: updatedTypes.map((at) => ({
          id: at.id,
          name: at.name,
          duration: at.duration,
          category: at.category || "",
          formIds: appointmentTypeFormsMap.get(at.id) || [],
        })),
        typesWithForms: typesWithForms.map((at) => ({
          id: at.id,
          name: at.name,
          duration: at.duration,
          category: at.category || "",
          formIds: appointmentTypeFormsMap.get(at.id) || [],
        })),
        typesWithMissingForms: typesWithMissingForms.map((at) => ({
          id: at.id,
          name: at.name,
          duration: at.duration,
          category: at.category || "",
          formIds: appointmentTypeFormsMap.get(at.id) || [],
        })),
        availableFormIds,
      });
    } catch (error) {
      logger.error("Failed to preview appointment types sync", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to preview sync",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  })

  // Perform actual sync to database
  .post("/integration/acuity/appointment-types/sync", async (c) => {
    const auth = c.get("auth");
    const adminUser = auth.user;

    try {
      const body = await c.req.json();
      const { acuityTypes, newTypes, updatedTypes } = body;

      if (!acuityTypes || !Array.isArray(acuityTypes)) {
        return c.json(
          {
            success: false,
            error: "Invalid data format",
          },
          400
        );
      }

      let syncedCount = 0;

      // Use a transaction to ensure data consistency
      await db.transaction(async (tx) => {
        // Insert new appointment types
        if (newTypes && newTypes.length > 0) {
          for (const type of newTypes) {
            const acuityType = acuityTypes.find((at) => at.id === type.id);
            if (!acuityType) continue;

            await tx.insert(acuityAppointmentTypes).values({
              id: acuityType.id,
              active: acuityType.active !== false,
              name: acuityType.name,
              description: acuityType.description || "",
              duration: acuityType.duration,
              price: acuityType.price ? String(acuityType.price) : null,
              category: acuityType.category || "",
              color: acuityType.color || null,
              private: acuityType.private === true,
              addonIds: acuityType.addonIDs || [],
              schedulingUrl: acuityType.schedulingUrl || "",
              lastSyncedAt: new Date(),
            });

            // If this type has forms, create the relationships
            if (acuityType.formIDs && acuityType.formIDs.length > 0) {
              for (const formId of acuityType.formIDs) {
                // Check if form exists in database
                const formExists = await tx
                  .select({ id: acuityForms.id })
                  .from(acuityForms)
                  .where(eq(acuityForms.id, formId))
                  .limit(1);

                if (formExists.length > 0) {
                  await tx
                    .insert(acuityAppointmentTypeForms)
                    .values({
                      appointmentTypeId: acuityType.id,
                      formId: formId,
                    })
                    .onConflictDoNothing();
                }
              }
            }

            syncedCount++;
          }
        }

        // Update existing appointment types
        if (updatedTypes && updatedTypes.length > 0) {
          for (const type of updatedTypes) {
            const acuityType = acuityTypes.find((at) => at.id === type.id);
            if (!acuityType) continue;

            await tx
              .update(acuityAppointmentTypes)
              .set({
                active: acuityType.active !== false,
                name: acuityType.name,
                description: acuityType.description || "",
                duration: acuityType.duration,
                price: acuityType.price ? String(acuityType.price) : null,
                category: acuityType.category || "",
                color: acuityType.color || null,
                private: acuityType.private === true,
                addonIds: acuityType.addonIDs || [],
                schedulingUrl: acuityType.schedulingUrl || "",
                lastSyncedAt: new Date(),
              })
              .where(eq(acuityAppointmentTypes.id, acuityType.id));

            // Update form relationships
            // First, delete existing relationships
            await tx
              .delete(acuityAppointmentTypeForms)
              .where(eq(acuityAppointmentTypeForms.appointmentTypeId, acuityType.id));

            // Then, create new relationships
            if (acuityType.formIDs && acuityType.formIDs.length > 0) {
              for (const formId of acuityType.formIDs) {
                // Check if form exists in database
                const formExists = await tx
                  .select({ id: acuityForms.id })
                  .from(acuityForms)
                  .where(eq(acuityForms.id, formId))
                  .limit(1);

                if (formExists.length > 0) {
                  await tx
                    .insert(acuityAppointmentTypeForms)
                    .values({
                      appointmentTypeId: acuityType.id,
                      formId: formId,
                    })
                    .onConflictDoNothing();
                }
              }
            }

            syncedCount++;
          }
        }
      });

      logger.info("Admin synced appointment types to database", {
        syncedBy: adminUser?.id,
        count: syncedCount,
        new: newTypes?.length || 0,
        updated: updatedTypes?.length || 0,
      });

      return c.json({
        success: true,
        synced: syncedCount,
        message: "Appointment types synced successfully",
      });
    } catch (error) {
      logger.error("Failed to sync appointment types to database", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to sync appointment types",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  })

  .get("/integration/acuity/sync/appointment-types", async (c) => {
    const auth = c.get("auth");
    const adminUser = auth.user;

    try {
      // Fetch appointment types from Acuity
      const appointmentTypes = await acuityService.getAppointmentTypes();

      logger.info("Admin fetched appointment types from Acuity", {
        syncedBy: adminUser?.id,
        count: appointmentTypes.length,
      });

      return c.json({
        success: true,
        count: appointmentTypes.length,
        data: appointmentTypes,
      });
    } catch (error) {
      logger.error("Failed to fetch appointment types from Acuity", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to fetch appointment types from Acuity",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  })

  .get("/integration/acuity/sync/forms", async (c) => {
    const auth = c.get("auth");
    const adminUser = auth.user;

    try {
      // Fetch forms from Acuity
      // Note: getForms method needs to be implemented in acuityService
      const forms = await acuityService.getForms();

      logger.info("Admin fetched forms from Acuity", {
        syncedBy: adminUser?.id,
        count: forms.length,
      });

      return c.json({
        success: true,
        count: forms.length,
        data: forms,
      });
    } catch (error) {
      logger.error("Failed to fetch forms from Acuity", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to fetch forms from Acuity",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  })

  // Forms endpoints for the integration page
  .get("/integration/acuity/forms", async (c) => {
    try {
      // Fetch forms from database
      const formsData = await db
        .select({
          id: acuityForms.id,
          name: acuityForms.name,
          description: acuityForms.description,
          hidden: acuityForms.hidden,
          lastSyncedAt: acuityForms.lastSyncedAt,
        })
        .from(acuityForms)
        .orderBy(acuityForms.name);

      // Get appointment type counts for each form
      const appointmentTypeCounts = await db
        .select({
          formId: acuityAppointmentTypeForms.formId,
          count: sql<number>`count(*)::int`,
        })
        .from(acuityAppointmentTypeForms)
        .groupBy(acuityAppointmentTypeForms.formId);

      // Get field counts for each form
      const fieldCounts = await db
        .select({
          formId: acuityFormsFields.formId,
          count: sql<number>`count(*)::int`,
        })
        .from(acuityFormsFields)
        .groupBy(acuityFormsFields.formId);

      // Create lookup maps
      const appointmentTypeCountMap = new Map(
        appointmentTypeCounts.map((item) => [item.formId, item.count])
      );

      const fieldCountMap = new Map(fieldCounts.map((item) => [item.formId, item.count]));

      // Add counts to each form
      const forms = formsData.map((form) => ({
        ...form,
        appointmentTypeCount: appointmentTypeCountMap.get(form.id) || 0,
        fieldCount: fieldCountMap.get(form.id) || 0,
      }));

      return c.json({
        success: true,
        data: forms,
      });
    } catch (error) {
      logger.error("Failed to fetch forms from database", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to fetch forms",
        },
        500
      );
    }
  })

  // Get a single form with fields from database
  .get("/integration/acuity/forms/:id", async (c) => {
    const formId = parseInt(c.req.param("id"));

    if (isNaN(formId)) {
      return c.json({ success: false, error: "Invalid form ID" }, 400);
    }

    try {
      // Get form from database
      const [form] = await db.select().from(acuityForms).where(eq(acuityForms.id, formId)).limit(1);

      if (!form) {
        return c.json({ success: false, error: "Form not found" }, 404);
      }

      // Get fields for this form
      const fields = await db
        .select()
        .from(acuityFormsFields)
        .where(eq(acuityFormsFields.formId, formId))
        .orderBy(asc(acuityFormsFields.id));

      return c.json({
        success: true,
        data: {
          ...form,
          fields,
        },
      });
    } catch (error) {
      logger.error("Failed to fetch form", error as Error, { formId });
      return c.json(
        {
          success: false,
          error: "Failed to fetch form",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  })

  // Preview forms sync
  .post("/integration/acuity/forms/preview", async (c) => {
    const auth = c.get("auth");
    const adminUser = auth.user;

    try {
      // Fetch from Acuity
      const acuityFormsData = await acuityService.getForms();

      // Fetch existing forms from database
      const existingForms = await db.select().from(acuityForms);

      // Categorize forms
      const newForms = acuityFormsData.filter((af) => !existingForms.find((ef) => ef.id === af.id));

      const updatedForms = acuityFormsData.filter((af) =>
        existingForms.find((ef) => ef.id === af.id)
      );

      logger.info("Admin previewed forms sync", {
        previewedBy: adminUser?.id,
        totalForms: acuityFormsData.length,
        newForms: newForms.length,
        updatedForms: updatedForms.length,
      });

      return c.json({
        success: true,
        acuityForms: acuityFormsData,
        existingForms,
        newForms,
        updatedForms,
      });
    } catch (error) {
      logger.error("Failed to preview forms sync", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to preview sync",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  })

  // Sync forms to database
  .post(
    "/integration/acuity/forms/sync",
    arktypeValidator(
      "json",
      type({
        "acuityForms?": type({
          id: "number",
          name: "string",
          "description?": "string",
          "hidden?": "boolean",
          "appointmentTypeIDs?": "number[]",
          "fields?": type({
            id: "number",
            name: "string",
            "required?": "boolean",
            type: "'textbox'|'textarea'|'dropdown'|'checkbox'|'checkboxlist'|'yesno'|'file'",
            "options?": "string[] | null",
          }).array(),
        }).array(),
        "newForms?": type({
          id: "number",
          name: "string",
          "description?": "string",
          "hidden?": "boolean",
        }).array(),
        "updatedForms?": type({
          id: "number",
          name: "string",
          "description?": "string",
          "hidden?": "boolean",
        }).array(),
      })
    ),
    async (c) => {
      const auth = c.get("auth");
      const adminUser = auth.user;

      try {
        const { acuityForms: acuityFormsData, newForms, updatedForms } = c.req.valid("json");

        let syncedCount = 0;

        // Use a transaction
        await db.transaction(async (tx) => {
          // Insert new forms
          if (newForms && newForms.length > 0 && acuityFormsData && acuityFormsData.length > 0) {
            for (const form of newForms) {
              const acuityForm = acuityFormsData.find((af) => af.id === form.id);
              if (!acuityForm) continue;

              await tx.insert(acuityForms).values({
                id: acuityForm.id,
                name: acuityForm.name || "",
                description: acuityForm.description || "",
                hidden: acuityForm.hidden === true,
                appointmentTypeIds: acuityForm.appointmentTypeIDs || [],
                lastSyncedAt: new Date(),
              });

              // If form has fields, sync them too
              if (acuityForm.fields && Array.isArray(acuityForm.fields)) {
                for (const field of acuityForm.fields) {
                  await tx.insert(acuityFormsFields).values({
                    id: field.id,
                    formId: acuityForm.id,
                    name: field.name,
                    required: field.required === true,
                    type: field.type,
                    options: field.options || null,
                    lastSyncedAt: new Date(),
                  });
                }
              }

              syncedCount++;
            }
          }

          // Update existing forms
          if (
            updatedForms &&
            updatedForms.length > 0 &&
            acuityFormsData &&
            acuityFormsData.length > 0
          ) {
            for (const form of updatedForms) {
              const acuityForm = acuityFormsData.find((af) => af.id === form.id);
              if (!acuityForm) continue;

              await tx
                .update(acuityForms)
                .set({
                  name: acuityForm.name || "",
                  description: acuityForm.description || "",
                  hidden: acuityForm.hidden === true,
                  appointmentTypeIds: acuityForm.appointmentTypeIDs || [],
                  lastSyncedAt: new Date(),
                })
                .where(eq(acuityForms.id, acuityForm.id));

              // Update fields - delete existing and re-insert
              await tx.delete(acuityFormsFields).where(eq(acuityFormsFields.formId, acuityForm.id));

              if (acuityForm.fields && Array.isArray(acuityForm.fields)) {
                for (const field of acuityForm.fields) {
                  await tx.insert(acuityFormsFields).values({
                    id: field.id,
                    formId: acuityForm.id,
                    name: field.name,
                    required: field.required === true,
                    type: field.type,
                    options: field.options || null,
                    lastSyncedAt: new Date(),
                  });
                }
              }

              syncedCount++;
            }
          }
        });

        logger.info("Admin synced forms to database", {
          syncedBy: adminUser?.id,
          count: syncedCount,
          new: newForms?.length || 0,
          updated: updatedForms?.length || 0,
        });

        return c.json({
          success: true,
          synced: syncedCount,
          message: "Forms synced successfully",
        });
      } catch (error) {
        logger.error("Failed to sync forms to database", error as Error);
        return c.json(
          {
            success: false,
            error: "Failed to sync forms",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // Get forms associated with an appointment type
  .get("/integration/acuity/appointment-types/:id/forms", async (c) => {
    const auth = c.get("auth");
    const appointmentTypeId = parseInt(c.req.param("id"));

    if (isNaN(appointmentTypeId)) {
      return c.json({ success: false, error: "Invalid appointment type ID" }, 400);
    }

    try {
      // Get form IDs associated with this appointment type
      const associations = await db
        .select({
          formId: acuityAppointmentTypeForms.formId,
        })
        .from(acuityAppointmentTypeForms)
        .where(eq(acuityAppointmentTypeForms.appointmentTypeId, appointmentTypeId));

      const formIds = associations.map((a) => a.formId);

      logger.info("Fetched form associations for appointment type", {
        appointmentTypeId,
        formCount: formIds.length,
        fetchedBy: auth.user?.id,
      });

      return c.json({
        success: true,
        formIds,
      });
    } catch (error) {
      logger.error("Failed to fetch form associations", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to fetch form associations",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  })

  // Update forms associated with an appointment type
  .put(
    "/integration/acuity/appointment-types/:id/forms",
    arktypeValidator("json", type({ formIds: "number[]" })),
    async (c) => {
      const auth = c.get("auth");
      const appointmentTypeId = parseInt(c.req.param("id"));
      const { formIds } = c.req.valid("json");

      if (isNaN(appointmentTypeId)) {
        return c.json({ success: false, error: "Invalid appointment type ID" }, 400);
      }

      try {
        // Use a transaction to update associations
        await db.transaction(async (tx) => {
          // First, delete all existing associations for this appointment type
          await tx
            .delete(acuityAppointmentTypeForms)
            .where(eq(acuityAppointmentTypeForms.appointmentTypeId, appointmentTypeId));

          // Then, insert new associations
          if (formIds.length > 0) {
            const associations = formIds.map((formId) => ({
              appointmentTypeId,
              formId,
            }));

            await tx.insert(acuityAppointmentTypeForms).values(associations);
          }
        });

        logger.info("Updated form associations for appointment type", {
          appointmentTypeId,
          formCount: formIds.length,
          updatedBy: auth.user?.id,
        });

        return c.json({
          success: true,
          message: "Form associations updated successfully",
          formCount: formIds.length,
        });
      } catch (error) {
        logger.error("Failed to update form associations", error as Error);
        return c.json(
          {
            success: false,
            error: "Failed to update form associations",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          500
        );
      }
    }
  )

  // ================== APP FORMS ENDPOINTS ==================

  // Validation schemas for app forms
  .post(
    "/app-forms",
    arktypeValidator(
      "json",
      type({
        acuityFormId: "number",
        name: "string>=1",
        "description?": "string",
      })
    ),
    async (c) => {
      const { acuityFormId, name, description } = c.req.valid("json");
      const auth = c.get("auth");

      try {
        const form = await appFormsService.createAppForm(acuityFormId, {
          name,
          description,
        });

        logger.info("Admin created app form", {
          createdBy: auth.user?.id,
          appFormId: form.id,
          acuityFormId,
        });

        return c.json(
          {
            success: true,
            data: form,
          },
          201
        );
      } catch (error) {
        logger.error("Failed to create app form", error as Error, { acuityFormId });

        if ((error as Error & { name?: string }).name === "NotFoundError") {
          return c.json({ success: false, error: "Acuity form not found" }, 404);
        }

        if ((error as Error & { name?: string }).name === "ValidationError") {
          return c.json({ success: false, error: (error as Error).message }, 400);
        }

        return c.json(
          {
            success: false,
            error: "Failed to create app form",
            message: (error as Error).message || "Unknown error",
          },
          500
        );
      }
    }
  )

  // List all app forms
  .get("/app-forms", async (c) => {
    const auth = c.get("auth");

    try {
      const forms = await appFormsService.listAppForms();

      logger.info("Admin listed app forms", {
        requestedBy: auth.user?.id,
        count: forms.length,
      });

      return c.json({
        success: true,
        data: forms,
      });
    } catch (error) {
      logger.error("Failed to list app forms", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to list app forms",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  })

  // Get a single app form with fields
  .get("/app-forms/:id", async (c) => {
    const id = c.req.param("id");
    const auth = c.get("auth");

    try {
      const form = await appFormsService.getAppFormById(id);

      logger.info("Admin retrieved app form", {
        requestedBy: auth.user?.id,
        appFormId: id,
      });

      return c.json({
        success: true,
        data: form,
      });
    } catch (error: unknown) {
      const err = error as Error & { name?: string };
      logger.error("Failed to get app form", err, { id });

      if (err.name === "NotFoundError") {
        return c.json({ success: false, error: "App form not found" }, 404);
      }

      return c.json(
        {
          success: false,
          error: "Failed to get app form",
          message: err.message || "Unknown error",
        },
        500
      );
    }
  })

  // Update app form metadata
  .put(
    "/app-forms/:id",
    arktypeValidator(
      "json",
      type({
        "name?": "string>=1",
        "description?": "string",
        "isActive?": "boolean",
      })
    ),
    async (c) => {
      const id = c.req.param("id");
      const data = c.req.valid("json");
      const auth = c.get("auth");

      try {
        const form = await appFormsService.updateAppForm(id, data);

        logger.info("Admin updated app form", {
          updatedBy: auth.user?.id,
          appFormId: id,
          updates: Object.keys(data),
        });

        return c.json({
          success: true,
          data: form,
        });
      } catch (error: unknown) {
        const err = error as Error & { name?: string };
        logger.error("Failed to update app form", err, { id });

        if (err.name === "NotFoundError") {
          return c.json({ success: false, error: "App form not found" }, 404);
        }

        return c.json(
          {
            success: false,
            error: "Failed to update app form",
            message: err.message || "Unknown error",
          },
          500
        );
      }
    }
  )

  // Update app form fields configuration
  .put(
    "/app-forms/:id/fields",
    arktypeValidator(
      "json",
      type({
        fields: type({
          id: "string",
          "customLabel?": "string|null",
          "placeholderText?": "string|null",
          "helpText?": "string|null",
          "tooltipText?": "string|null",
          "customFieldType?": "'text'|'email'|'phone'|'number'|'date'|'dob'|'time'|'url'|null",
          "isRequired?": "boolean",
          "validationRules?": "object",
          "isHidden?": "boolean",
          "staticValue?": "string|null",
          "displayOrder?": "number>=1",
          "displayWidth?": "'full'|'half'|'third'",
          "examineeFieldMapping?":
            "'firstName'|'lastName'|'dateOfBirth'|'email'|'phoneNumber'|'address'|'authorizedContact'|'condition'|'caseType'|null",
        }).array(),
      })
    ),
    async (c) => {
      const id = c.req.param("id");
      const { fields } = c.req.valid("json");
      const auth = c.get("auth");

      try {
        const updatedFields = await appFormsService.updateAppFormFields(id, fields);

        logger.info("Admin updated app form fields", {
          updatedBy: auth.user?.id,
          appFormId: id,
          fieldsUpdated: updatedFields.length,
        });

        return c.json({
          success: true,
          data: updatedFields,
        });
      } catch (error: unknown) {
        const err = error as Error & { name?: string };
        logger.error("Failed to update app form fields", err, { id });

        if (err.name === "NotFoundError") {
          return c.json({ success: false, error: "App form not found" }, 404);
        }

        if (err.name === "ValidationError") {
          return c.json({ success: false, error: err.message }, 400);
        }

        return c.json(
          {
            success: false,
            error: "Failed to update app form fields",
            message: err.message || "Unknown error",
          },
          500
        );
      }
    }
  )

  // Delete an app form
  .delete("/app-forms/:id", async (c) => {
    const id = c.req.param("id");
    const auth = c.get("auth");

    try {
      await appFormsService.deleteAppForm(id);

      logger.info("Admin deleted app form", {
        deletedBy: auth.user?.id,
        appFormId: id,
      });

      return c.json({
        success: true,
        message: "App form deleted successfully",
      });
    } catch (error: unknown) {
      const err = error as Error & { name?: string };
      logger.error("Failed to delete app form", err, { id });

      if (err.name === "NotFoundError") {
        return c.json({ success: false, error: "App form not found" }, 404);
      }

      return c.json(
        {
          success: false,
          error: "Failed to delete app form",
          message: err.message || "Unknown error",
        },
        500
      );
    }
  })

  // Check if app form exists for an Acuity form
  .get("/app-forms/check/:acuityFormId", async (c) => {
    const acuityFormId = parseInt(c.req.param("acuityFormId"));

    if (isNaN(acuityFormId)) {
      return c.json({ success: false, error: "Invalid Acuity form ID" }, 400);
    }

    try {
      const form = await appFormsService.getAppFormByAcuityFormId(acuityFormId);

      // This is not an error - just return the result
      return c.json({
        success: true,
        exists: !!form,
        data: form || null,
      });
    } catch (error) {
      // Only log actual errors, not "not found" cases
      logger.error("Database error checking app form", error as Error, { acuityFormId });
      return c.json(
        {
          success: false,
          error: "Failed to check app form",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  })
  .get("/app-forms/by-acuity-id/:id", async (c) => {
    const acuityFormId = parseInt(c.req.param("id"));

    if (isNaN(acuityFormId)) {
      return c.json({ success: false, error: "Invalid Acuity form ID" }, 400);
    }

    try {
      const form = await appFormsService.getAppFormByAcuityFormId(acuityFormId);

      if (!form) {
        return c.json(
          {
            success: false,
            error: "App form not found for this Acuity form",
          },
          404
        );
      }

      return c.json({
        success: true,
        data: form,
      });
    } catch (error) {
      logger.error("Failed to fetch app form by Acuity ID", error as Error, { acuityFormId });
      return c.json(
        {
          success: false,
          error: "Failed to fetch app form",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  });

export default app;
