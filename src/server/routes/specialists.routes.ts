import { Hono } from "hono";
import { type } from "arktype";
import { authMiddleware, requireAuth, requireRole } from "@/server/middleware/auth.middleware";
import { arktypeValidator } from "@/server/middleware/validate.middleware";
import {
  specialistRepository,
  LocationInput,
  type UpdatePositionsInputType,
} from "@/server/repositories/specialist.repository";
import { appointmentTypeRepository } from "@/server/repositories/appointment-type.repository";
import { acuityService } from "@/server/services/acuity.service";
import { logger } from "@/server/utils/logger";
import { generateSlug } from "@/lib/utils/slug";
import type { SpecialistAvailabilityResponse } from "@/types/acuity";
import type { SpecialistLocation } from "@/server/db/schema";

// Helper function for role-based field filtering
function getSpecialistFields(
  user: { id: string; role?: string | null },
  specialist: {
    id: string;
    userId: string;
    acuityCalendarId: string;
    name: string;
    slug: string | null;
    image?: string | null;
    location: SpecialistLocation | null;
    acceptsInPerson?: boolean;
    acceptsTelehealth?: boolean;
    position: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  specialistUser: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
  }
) {
  const baseFields = {
    id: specialist.id,
    name: specialist.name,
    slug: specialist.slug,
    image: specialist.image,
    location: specialist.location,
    acceptsInPerson: specialist.acceptsInPerson ?? false,
    acceptsTelehealth: specialist.acceptsTelehealth ?? true,
    position: specialist.position,
    isActive: specialist.isActive,
    user: {
      id: specialistUser.id,
      firstName: specialistUser.firstName,
      lastName: specialistUser.lastName,
      jobTitle: specialistUser.jobTitle,
    },
    createdAt: specialist.createdAt,
    updatedAt: specialist.updatedAt,
  };

  // Add sensitive fields only for authorized users (admin or the specialist themselves)
  if (user.role === "admin" || user.id === specialist.userId) {
    return {
      ...baseFields,
      userId: specialist.userId,
      acuityCalendarId: specialist.acuityCalendarId,
      user: {
        ...baseFields.user,
        email: specialistUser.email,
      },
    };
  }

  return baseFields;
}

// Validation schemas
const syncSpecialistSchema = type({
  userId: "string",
  acuityCalendarId: "string",
});

const checkSlugSchema = type({
  slug: "string",
});

const specialistsRoutes = new Hono()

  // Apply auth middleware to all routes
  .use("*", authMiddleware)
  .use("*", requireAuth)

  // POST /api/specialists/check-slug - Check if a slug is available
  .post(
    "/check-slug",
    requireRole("admin"),
    arktypeValidator("json", checkSlugSchema),
    async (c) => {
      const { slug } = c.req.valid("json");

      try {
        const existing = await specialistRepository.findBySlug(slug);
        return c.json({ available: !existing });
      } catch (error) {
        logger.error("Failed to check specialist slug availability", error as Error);
        return c.json({ available: false }, 500);
      }
    }
  )

  // GET /api/specialists - List all active specialists
  .get("/", async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const includeInactive = c.req.query("includeInactive") === "true";
      const appointmentType = c.req.query("appointmentType") as
        | "in_person"
        | "telehealth"
        | "both"
        | undefined;
      const city = c.req.query("city");
      const state = c.req.query("state");

      // Audit log the access
      logger.audit("view_specialist_list", user.id, "specialist", "list", {
        includeInactive,
        appointmentType,
        city,
        state,
        userRole: user.role,
      });

      let specialists;

      // Apply filters based on query parameters
      if (appointmentType) {
        specialists = await specialistRepository.findByAppointmentType(appointmentType);
      } else if (city || state) {
        specialists = await specialistRepository.searchByLocation(city, state);
      } else {
        specialists = includeInactive
          ? await specialistRepository.findAll()
          : await specialistRepository.findAllActive();
      }

      const data = specialists.map(({ specialist, user: specialistUser }) =>
        getSpecialistFields(user, specialist, specialistUser)
      );

      return c.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error("Failed to list specialists", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to retrieve specialists",
        },
        500
      );
    }
  })

  // GET /api/specialists/:id - Get specialist by ID
  .get("/:id", async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const id = c.req.param("id");

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return c.json(
          {
            success: false,
            error: "Invalid specialist ID format",
          },
          400
        );
      }

      const result = await specialistRepository.findById(id);

      if (!result) {
        return c.json(
          {
            success: false,
            error: "Specialist not found",
          },
          404
        );
      }

      const { specialist, user: specialistUser } = result;

      // Audit log the access
      logger.audit("view_specialist_details", user.id, "specialist", specialist.id, {
        userRole: user.role,
        specialistUserId: specialist.userId,
      });

      return c.json({
        success: true,
        data: getSpecialistFields(user, specialist, specialistUser),
      });
    } catch (error) {
      logger.error("Failed to get specialist", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to retrieve specialist",
        },
        500
      );
    }
  })

  // POST /api/specialists/sync - Sync specialist with Acuity calendar (Admin only)
  .post(
    "/sync",
    requireRole("admin"),
    arktypeValidator("json", syncSpecialistSchema),
    async (c) => {
      try {
        const data = c.req.valid("json");

        // Check if user already has a specialist profile
        const existingSpecialist = await specialistRepository.findByUserId(data.userId);
        if (existingSpecialist) {
          return c.json(
            {
              success: false,
              error: "User is already registered as a specialist",
            },
            400
          );
        }

        // Check if calendar is already linked to another specialist
        const calendarInUse = await specialistRepository.isCalendarLinked(data.acuityCalendarId);
        if (calendarInUse) {
          return c.json(
            {
              success: false,
              error: "This Acuity calendar is already linked to another specialist",
            },
            400
          );
        }

        // Validate calendar exists in Acuity
        const acuityCalendar = await acuityService.getCalendarById(data.acuityCalendarId);
        if (!acuityCalendar) {
          return c.json(
            {
              success: false,
              error: "Invalid Acuity calendar ID - calendar not found",
            },
            400
          );
        }

        // Generate a unique slug based on calendar name
        const baseSlug = generateSlug(acuityCalendar.name);
        let slug = baseSlug;
        let counter = 1;

        // Check for slug uniqueness and append counter if needed
        while (await specialistRepository.findBySlug(slug)) {
          counter++;
          slug = `${baseSlug}-${counter}`;
        }

        // Create specialist profile
        const specialist = await specialistRepository.create({
          userId: data.userId,
          acuityCalendarId: data.acuityCalendarId,
          name: acuityCalendar.name,
          slug,
          location: null,
          isActive: true,
        });

        // Audit log the sync action
        const authContext = c.get("auth");
        const adminUser = authContext?.user;
        if (adminUser) {
          logger.audit("sync_specialist", adminUser.id, "specialist", specialist.id, {
            targetUserId: data.userId,
            acuityCalendarId: data.acuityCalendarId,
          });
        }

        logger.info("Specialist synchronized with Acuity", {
          specialistId: specialist.id,
          userId: data.userId,
          acuityCalendarId: data.acuityCalendarId,
        });

        return c.json({
          success: true,
          data: specialist,
          message: "Specialist successfully synchronized with Acuity calendar",
        });
      } catch (error) {
        logger.error("Failed to sync specialist", error as Error);
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to sync specialist",
          },
          500
        );
      }
    }
  )

  // PUT /api/specialists/positions - Bulk update positions (Admin only)
  .put(
    "/positions",
    requireRole("admin"),
    arktypeValidator(
      "json",
      type({
        id: "string",
        position: "number",
      }).array()
    ),
    async (c) => {
      try {
        const positions = c.req.valid("json");

        // Validate all positions are unique
        const positionSet = new Set(positions.map((p) => p.position));
        if (positionSet.size !== positions.length) {
          return c.json(
            {
              success: false,
              error: "Duplicate positions provided",
            },
            400
          );
        }

        // Update positions in a transaction
        const result = await specialistRepository.updatePositions(
          positions as UpdatePositionsInputType
        );

        // Audit log the update
        const authContext = c.get("auth");
        const adminUser = authContext?.user;
        if (adminUser) {
          logger.audit("update_specialist_positions", adminUser.id, "specialist", "bulk", {
            updatedCount: result.updated,
            positions: positions.map((p) => ({ id: p.id, position: p.position })),
          });
        }

        logger.info("Specialist positions updated", {
          updatedCount: result.updated,
        });

        return c.json({
          success: true,
          data: result,
          message: "Positions updated successfully",
        });
      } catch (error) {
        logger.error("Failed to update specialist positions", error as Error);
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update positions",
          },
          500
        );
      }
    }
  )

  // PUT /api/specialists/:id - Update specialist details (Admin only)
  .put(
    "/:id",
    requireRole("admin"),
    arktypeValidator(
      "json",
      type({
        "name?": "string",
        "slug?": "string | null",
        "image?": "string | null",
        "location?": LocationInput.or("null"),
        "acceptsInPerson?": "boolean",
        "acceptsTelehealth?": "boolean",
        "isActive?": "boolean",
      })
    ),
    async (c) => {
      try {
        const id = c.req.param("id");
        const updateData = c.req.valid("json");

        // Check if specialist exists
        const existing = await specialistRepository.findById(id);
        if (!existing) {
          return c.json(
            {
              success: false,
              error: "Specialist not found",
            },
            404
          );
        }

        // Update specialist - updateData now matches UpdateSpecialistInputType
        const updated = await specialistRepository.update(id, {
          name: updateData.name,
          slug: updateData.slug ?? null,
          image: updateData.image,
          isActive: updateData.isActive,
          location: updateData.location ?? null,
        });

        // Audit log the update
        const authContext = c.get("auth");
        const adminUser = authContext?.user;
        if (adminUser) {
          logger.audit("update_specialist", adminUser.id, "specialist", id, {
            updates: Object.keys(updateData),
            oldValues: existing.specialist,
            newValues: updateData,
          });
        }

        logger.info("Specialist updated", {
          specialistId: id,
          updates: Object.keys(updateData),
        });

        return c.json({
          success: true,
          data: updated,
          message: "Specialist updated successfully",
        });
      } catch (error) {
        logger.error("Failed to update specialist", error as Error);
        return c.json(
          {
            success: false,
            error: "Failed to update specialist",
          },
          500
        );
      }
    }
  )

  // DELETE /api/specialists/:id/deactivate - Deactivate specialist (Admin only)
  .delete("/:id/deactivate", requireRole("admin"), async (c) => {
    try {
      const id = c.req.param("id");

      const specialist = await specialistRepository.deactivate(id);
      if (!specialist) {
        return c.json(
          {
            success: false,
            error: "Specialist not found",
          },
          404
        );
      }

      // Audit log the deactivation
      const authContext = c.get("auth");
      const adminUser = authContext?.user;
      if (adminUser) {
        logger.audit("deactivate_specialist", adminUser.id, "specialist", id, {
          action: "deactivate",
        });
      }

      logger.info("Specialist deactivated", { specialistId: id });

      return c.json({
        success: true,
        message: "Specialist deactivated successfully",
      });
    } catch (error) {
      logger.error("Failed to deactivate specialist", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to deactivate specialist",
        },
        500
      );
    }
  })

  // POST /api/specialists/:id/activate - Activate specialist (Admin only)
  .post("/:id/activate", requireRole("admin"), async (c) => {
    try {
      const id = c.req.param("id");

      const specialist = await specialistRepository.activate(id);
      if (!specialist) {
        return c.json(
          {
            success: false,
            error: "Specialist not found",
          },
          404
        );
      }

      // Audit log the activation
      const authContext = c.get("auth");
      const adminUser = authContext?.user;
      if (adminUser) {
        logger.audit("activate_specialist", adminUser.id, "specialist", id, {
          action: "activate",
        });
      }

      logger.info("Specialist activated", { specialistId: id });

      return c.json({
        success: true,
        message: "Specialist activated successfully",
      });
    } catch (error) {
      logger.error("Failed to activate specialist", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to activate specialist",
        },
        500
      );
    }
  })

  // GET /api/specialists/:id/appointment-types - Get specialist appointment types
  .get("/:id/appointment-types", async (c) => {
    try {
      const authContext = c.get("auth");
      const specialistId = c.req.param("id");
      const refresh = c.req.query("refresh") === "true";

      if (!authContext?.user) {
        return c.json(
          {
            success: false,
            error: "Authentication required",
          },
          401
        );
      }

      // Get specialist details
      const specialistData = await specialistRepository.findById(specialistId);
      if (!specialistData) {
        return c.json(
          {
            success: false,
            error: "Specialist not found",
          },
          404
        );
      }

      // Refresh from Acuity if requested
      if (refresh) {
        const acuityTypes = await acuityService.getAppointmentTypes();
        await appointmentTypeRepository.upsertFromAcuity(acuityTypes);
      }

      // Get specialist-specific appointment types with overrides
      const appointmentTypes = await appointmentTypeRepository.getSpecialistAppointmentTypes(
        specialistId,
        true // enabledOnly
      );

      // Return appointment types with effective and source information
      return c.json({
        success: true,
        data: appointmentTypes.map((type) => ({
          id: type.id,
          acuityAppointmentTypeId: type.acuityAppointmentTypeId,
          name: type.effectiveName,
          description: type.effectiveDescription,
          duration: type.durationMinutes,
          category: type.category,
          appointmentMode: type.appointmentMode,
          source: {
            name: type.sourceName,
            description: type.sourceDescription,
          },
        })),
      });
    } catch (error) {
      logger.error("Failed to fetch appointment types", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to fetch appointment types",
        },
        500
      );
    }
  })

  // GET /api/specialists/:id/appointment-types/admin - Get all appointment types for admin management
  .get("/:id/appointment-types/admin", requireRole("admin"), async (c) => {
    try {
      const specialistId = c.req.param("id");

      // Verify specialist exists
      const specialistData = await specialistRepository.findById(specialistId);
      if (!specialistData) {
        return c.json(
          {
            success: false,
            error: "Specialist not found",
          },
          404
        );
      }

      // Get ALL appointment types with optional specialist mappings
      const appointmentTypes =
        await appointmentTypeRepository.getAllAppointmentTypesForSpecialist(specialistId);

      // Return with full data including Acuity originals
      return c.json({
        success: true,
        data: appointmentTypes.map((type) => ({
          id: type.id,
          acuityAppointmentTypeId: type.acuityAppointmentTypeId,
          acuityName: type.acuityName,
          acuityDescription: type.acuityDescription,
          name: type.effectiveName,
          description: type.effectiveDescription,
          duration: type.durationMinutes,
          category: type.category,
          enabled: type.enabled ?? false,
          appointmentMode: type.appointmentMode,
          customDisplayName: type.customDisplayName,
          customDescription: type.customDescription,
          customPrice: type.customPrice,
          notes: type.notes,
          source: {
            name: type.sourceName,
            description: type.sourceDescription,
          },
        })),
      });
    } catch (error) {
      logger.error("Failed to fetch appointment types for admin", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to fetch appointment types",
        },
        500
      );
    }
  })

  // POST /api/specialists/:id/appointment-types/sync - Sync appointment types from Acuity (Admin only)
  .post(
    "/:id/appointment-types/sync",
    requireRole("admin"),
    arktypeValidator(
      "json",
      type({
        strategy: '"none" | "auto-enable-by-category"',
      })
    ),
    async (c) => {
      try {
        const specialistId = c.req.param("id");
        const { strategy } = c.req.valid("json");
        const authContext = c.get("auth");
        const adminUser = authContext?.user;

        // Verify specialist exists
        const specialistData = await specialistRepository.findById(specialistId);
        if (!specialistData) {
          return c.json(
            {
              success: false,
              error: "Specialist not found",
            },
            404
          );
        }

        // Sync from Acuity
        const acuityTypes = await acuityService.getAppointmentTypes();
        const synced = await appointmentTypeRepository.upsertFromAcuity(
          acuityTypes.filter((types) =>
            types.calendarIDs.includes(parseInt(specialistData.specialist.acuityCalendarId))
          )
        );

        let enabledChanged = 0;
        if (strategy === "auto-enable-by-category") {
          // Auto-enable appointment types based on common categories
          const commonCategories = ["General", "Initial", "Follow-up"];
          enabledChanged = await appointmentTypeRepository.autoEnableByCategory(
            specialistId,
            commonCategories
          );
        }

        // Audit log
        if (adminUser) {
          logger.audit(
            "sync_specialist_appointment_types",
            adminUser.id,
            "specialist",
            specialistId,
            {
              strategy,
              syncedCount: synced.length,
              enabledChanged,
            }
          );
        }

        return c.json({
          success: true,
          synced: synced.length,
          enabledChanged: strategy === "auto-enable-by-category" ? enabledChanged : undefined,
          lastSyncedAt: new Date().toISOString(),
        });
      } catch (error) {
        logger.error("Failed to sync appointment types", error as Error);
        return c.json(
          {
            success: false,
            error: "Failed to sync appointment types",
          },
          500
        );
      }
    }
  )

  // PUT /api/specialists/:id/appointment-types - Bulk update appointment type mappings (Admin only)
  .put(
    "/:id/appointment-types",
    requireRole("admin"),
    arktypeValidator(
      "json",
      type({
        items: type({
          appointmentTypeId: "string",
          "enabled?": "boolean",
          appointmentMode: type("'in-person' | 'telehealth'"),
          "customDisplayName?": "string | null",
          "customDescription?": "string | null",
          "customPrice?": "number | null",
          "notes?": "string | null",
        }).array(),
      })
    ),
    async (c) => {
      try {
        const specialistId = c.req.param("id");
        const { items } = c.req.valid("json");
        const authContext = c.get("auth");
        const adminUser = authContext?.user;

        // Verify specialist exists
        const specialistData = await specialistRepository.findById(specialistId);
        if (!specialistData) {
          return c.json(
            {
              success: false,
              error: "Specialist not found",
            },
            404
          );
        }

        // Bulk update mappings
        const results = await appointmentTypeRepository.bulkUpdateSpecialistMappings(
          specialistId,
          items
        );

        // Audit log
        if (adminUser) {
          logger.audit(
            "update_specialist_appointment_types",
            adminUser.id,
            "specialist",
            specialistId,
            {
              updatedCount: results.length,
              items: items.map((item) => ({
                appointmentTypeId: item.appointmentTypeId,
                enabled: item.enabled,
                hasOverrides: !!(item.customDisplayName || item.customDescription),
              })),
            }
          );
        }

        return c.json({
          success: true,
          updated: results.length,
        });
      } catch (error) {
        logger.error("Failed to update appointment type mappings", error as Error);
        return c.json(
          {
            success: false,
            error: "Failed to update appointment type mappings",
          },
          500
        );
      }
    }
  )
  .get("/:id/availability", async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const specialistId = c.req.param("id");
      const { startDate, endDate, appointmentTypeId, timezone } = c.req.query();

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(specialistId)) {
        return c.json(
          {
            success: false,
            error: "Invalid specialist ID format",
          },
          400
        );
      }

      // Validate required parameters
      if (!startDate || !endDate) {
        return c.json(
          {
            success: false,
            error: "Start date and end date are required",
          },
          400
        );
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return c.json(
          {
            success: false,
            error: "Dates must be in YYYY-MM-DD format",
          },
          400
        );
      }

      // Get specialist details
      const specialistData = await specialistRepository.findById(specialistId);
      if (!specialistData) {
        return c.json(
          {
            success: false,
            error: "Specialist not found",
          },
          404
        );
      }

      if (!specialistData.specialist.isActive) {
        return c.json(
          {
            success: false,
            error: "Specialist is not active",
          },
          400
        );
      }

      // Get appointment types if not specified
      let appointmentTypes;
      if (!appointmentTypeId) {
        appointmentTypes = await acuityService.getAppointmentTypes();
        if (appointmentTypes.length === 0) {
          return c.json(
            {
              success: false,
              error: "No appointment types available",
            },
            404
          );
        }
      }

      // Fetch availability for each date in the range
      const availability: SpecialistAvailabilityResponse = {
        specialistId: specialistData.specialist.id,
        calendarId: specialistData.specialist.acuityCalendarId,
        timeSlots: [],
      };

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate date range (max 30 days)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff > 30) {
        return c.json(
          {
            success: false,
            error: "Date range cannot exceed 30 days",
          },
          400
        );
      }

      // Iterate through each date
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split("T")[0];

        // If appointmentTypeId is provided, fetch for that specific type
        if (appointmentTypeId) {
          try {
            const slots = await acuityService.getAvailability({
              appointmentTypeId: parseInt(appointmentTypeId, 10),
              calendarId: parseInt(specialistData.specialist.acuityCalendarId, 10),
              date: dateStr,
              timezone,
            });

            availability.timeSlots.push(
              ...slots.map((slot) => ({
                date: slot.date,
                time: slot.time,
                datetime: slot.datetime,
                duration: slot.duration,
                appointmentTypeId: slot.appointmentTypeID,
                available: slot.canBook && slot.slotsAvailable > 0,
              }))
            );
          } catch (error) {
            logger.warn("Failed to fetch availability for date", { error, date: dateStr });
            // Continue to next date instead of failing entire request
          }
        } else {
          // Fetch for all appointment types
          for (const appointmentType of appointmentTypes!) {
            try {
              const slots = await acuityService.getAvailability({
                appointmentTypeId: appointmentType.id,
                calendarId: parseInt(specialistData.specialist.acuityCalendarId, 10),
                date: dateStr,
                timezone,
              });

              availability.timeSlots.push(
                ...slots.map((slot) => ({
                  date: slot.date,
                  time: slot.time,
                  datetime: slot.datetime,
                  duration: slot.duration,
                  appointmentTypeId: slot.appointmentTypeID,
                  available: slot.canBook && slot.slotsAvailable > 0,
                }))
              );
            } catch (error) {
              logger.warn("Failed to fetch availability for appointment type", {
                error,
                date: dateStr,
                appointmentTypeId: appointmentType.id,
              });
              // Continue to next appointment type
            }
          }
        }
      }

      // Sort time slots by datetime
      availability.timeSlots.sort(
        (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      );

      // Audit log the availability access
      logger.audit("view_specialist_availability", user.id, "specialist", specialistId, {
        userRole: user.role,
        dateRange: { startDate, endDate },
        appointmentTypeId,
        timezone,
        slotsFound: availability.timeSlots.length,
      });

      return c.json({
        success: true,
        data: availability,
      });
    } catch (error) {
      logger.error("Failed to get specialist availability", error as Error);
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to retrieve availability",
        },
        500
      );
    }
  });

export { specialistsRoutes };
