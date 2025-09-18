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
    acuityCalendarId: number;
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

const specialistsRoutes = new Hono()

  // Apply auth middleware to all routes
  .use("*", authMiddleware)
  .use("*", requireAuth)

  // POST /api/specialists/check-slug - Check if a slug is available
  .post(
    "/check-slug",
    requireRole("admin"),
    arktypeValidator(
      "json",
      type({
        slug: "string",
      })
    ),
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
    arktypeValidator(
      "json",
      type({
        userId: "string",
        acuityCalendarId: "string",
      })
    ),
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

  .get(
    "/:id/availability",
    arktypeValidator(
      "query",
      type({
        startDate: "string.date",
        endDate: "string.date",
        appointmentTypeId: "string",
        "timezone?": "string",
      })
    ),
    async (c) => {
      try {
        const authContext = c.get("auth");
        const user = authContext.user;
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const specialistId = c.req.param("id");
        const { startDate, endDate, appointmentTypeId, timezone } = c.req.valid("query");

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
              const times = await acuityService.getAvailabilityTimes({
                appointmentTypeId: parseInt(appointmentTypeId, 10),
                calendarId: specialistData.specialist.acuityCalendarId,
                date: dateStr,
                timezone,
              });

              availability.timeSlots.push(
                ...times.map((slot) => ({
                  date: dateStr,
                  time: slot.time,
                  datetime: slot.time, // time field contains full ISO datetime
                  duration: 30, // Default duration, adjust as needed
                  appointmentTypeId: parseInt(appointmentTypeId, 10),
                  available: true, // If returned by Acuity, it's available
                }))
              );
            } catch (error) {
              logger.warn("Failed to fetch availability for date", { error, date: dateStr });
              // Continue to next date instead of failing entire request
            }
          } else {
            // Fetch for all appointment types
            const appointmentTypes = await acuityService.getAppointmentTypes();
            for (const appointmentType of appointmentTypes) {
              try {
                const times = await acuityService.getAvailabilityTimes({
                  appointmentTypeId: appointmentType.id,
                  calendarId: specialistData.specialist.acuityCalendarId,
                  date: dateStr,
                  timezone,
                });

                availability.timeSlots.push(
                  ...times.map((slot) => ({
                    date: dateStr,
                    time: slot.time,
                    datetime: slot.time, // time field contains full ISO datetime
                    duration: appointmentType.duration, // Use actual duration from appointment type
                    appointmentTypeId: appointmentType.id,
                    available: true, // If returned by Acuity, it's available
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
    }
  )

  // GET /api/specialists/:id/available-dates - Get dates with availability for a month
  .get(
    "/:id/available-dates",
    arktypeValidator(
      "query",
      type({
        month: "string", // YYYY-MM format
        appointmentTypeId: "string",
      })
    ),
    async (c) => {
      try {
        const authContext = c.get("auth");
        const user = authContext?.user;
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const specialistId = c.req.param("id");
        const { month, appointmentTypeId } = c.req.valid("query");

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

        // Validate month format (YYYY-MM)
        const monthRegex = /^\d{4}-\d{2}$/;
        if (!monthRegex.test(month)) {
          return c.json(
            {
              success: false,
              error: "Month must be in YYYY-MM format",
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

        // Fetch available dates from Acuity (single API call)
        const availableDates = await acuityService.getAvailabilityDates({
          month,
          appointmentTypeId: parseInt(appointmentTypeId, 10),
          calendarId: specialistData.specialist.acuityCalendarId,
        });

        // Audit log the availability access
        logger.audit("view_specialist_available_dates", user.id, "specialist", specialistId, {
          userRole: user.role,
          month,
          appointmentTypeId,
          datesFound: availableDates.length,
        });

        return c.json({
          success: true,
          data: {
            specialistId: specialistData.specialist.id,
            month,
            dates: availableDates,
          },
        });
      } catch (error) {
        logger.error("Failed to get specialist available dates", error as Error);
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to retrieve available dates",
          },
          500
        );
      }
    }
  )

  // GET /api/specialists/:id/appointment-types - Get specialist appointment types (public)
  .get("/:id/appointment-types", async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const specialistId = c.req.param("id");

      // Import db and schema
      const { db } = await import("@/server/db");
      const { specialistAppointmentTypes, specialists } = await import(
        "@/server/db/schema/specialists"
      );
      const { acuityAppointmentTypes } = await import("@/server/db/schema/acuity");
      const { eq, and } = await import("drizzle-orm");

      // Verify specialist exists and is active
      const [specialist] = await db
        .select({ id: specialists.id, isActive: specialists.isActive })
        .from(specialists)
        .where(eq(specialists.id, specialistId));

      if (!specialist) {
        return c.json(
          {
            success: false,
            error: "Specialist not found",
          },
          404
        );
      }

      if (!specialist.isActive) {
        return c.json(
          {
            success: false,
            error: "Specialist is not active",
          },
          400
        );
      }

      // Fetch enabled appointment types for the specialist
      const appointmentTypes = await db
        .select({
          specialistId: specialistAppointmentTypes.specialistId,
          appointmentTypeId: specialistAppointmentTypes.appointmentTypeId,
          enabled: specialistAppointmentTypes.enabled,
          appointmentMode: specialistAppointmentTypes.appointmentMode,
          customDisplayName: specialistAppointmentTypes.customDisplayName,
          customDescription: specialistAppointmentTypes.customDescription,
          customPrice: specialistAppointmentTypes.customPrice,
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
        .where(
          and(
            eq(specialistAppointmentTypes.specialistId, specialistId),
            eq(specialistAppointmentTypes.enabled, true)
          )
        );

      // Transform data to match the expected format for the booking flow
      const transformedTypes = appointmentTypes
        .filter((item) => item.appointmentType?.active) // Only include active appointment types
        .map((item) => ({
          id: `${item.specialistId}_${item.appointmentTypeId}`,
          acuityAppointmentTypeId: item.appointmentTypeId,
          name: item.customDisplayName || item.appointmentType?.name || "Unknown",
          description: item.customDescription || item.appointmentType?.description || null,
          duration: item.appointmentType?.duration || 30,
          category: item.appointmentType?.category || null,
          appointmentMode: item.appointmentMode,
          source: {
            name: item.customDisplayName ? ("override" as const) : ("acuity" as const),
            description: item.customDescription ? ("override" as const) : ("acuity" as const),
          },
        }));

      // Audit log the access
      logger.audit("view_specialist_appointment_types", user.id, "specialist", specialistId, {
        userRole: user.role,
        typesFound: transformedTypes.length,
      });

      return c.json({
        success: true,
        data: transformedTypes,
      });
    } catch (error) {
      logger.error("Failed to get specialist appointment types", error as Error);
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to retrieve appointment types",
        },
        500
      );
    }
  })

  // GET /api/specialists/:id/appointment-types/:typeId/form - Get form for appointment type
  .get("/:id/appointment-types/:typeId/form", async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const specialistId = c.req.param("id");
      const appointmentTypeId = parseInt(c.req.param("typeId"), 10);

      if (isNaN(appointmentTypeId)) {
        return c.json(
          {
            success: false,
            error: "Invalid appointment type ID",
          },
          400
        );
      }

      // Import db and schema
      const { db } = await import("@/server/db");
      const { specialistAppointmentTypes } = await import("@/server/db/schema/specialists");
      const { acuityAppointmentTypeForms, acuityForms } = await import("@/server/db/schema/acuity");
      const { appForms, appFormFields } = await import("@/server/db/schema/appForms");
      const { eq, and } = await import("drizzle-orm");

      // Verify the appointment type belongs to the specialist
      const [specialistAppointmentType] = await db
        .select()
        .from(specialistAppointmentTypes)
        .where(
          and(
            eq(specialistAppointmentTypes.specialistId, specialistId),
            eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypeId),
            eq(specialistAppointmentTypes.enabled, true)
          )
        );

      if (!specialistAppointmentType) {
        return c.json(
          {
            success: false,
            error: "Appointment type not found or not enabled for this specialist",
          },
          404
        );
      }

      // Find forms linked to this appointment type
      const linkedForms = await db
        .select({
          formId: acuityAppointmentTypeForms.formId,
        })
        .from(acuityAppointmentTypeForms)
        .where(eq(acuityAppointmentTypeForms.appointmentTypeId, appointmentTypeId));

      if (linkedForms.length === 0) {
        return c.json({
          success: true,
          data: null,
          message: "No form configured for this appointment type",
        });
      }

      // Get the first linked form (could be enhanced to handle multiple forms)
      const acuityFormId = linkedForms[0].formId;

      // Check if there's an app form configuration for this Acuity form
      const appFormWithFields = await db
        .select({
          form: appForms,
          fields: appFormFields,
        })
        .from(appForms)
        .leftJoin(appFormFields, eq(appForms.id, appFormFields.appFormId))
        .where(and(eq(appForms.acuityFormId, acuityFormId), eq(appForms.isActive, true)));

      if (appFormWithFields.length === 0) {
        return c.json({
          success: true,
          data: null,
          message: "No custom form configuration available",
        });
      }

      // Get the Acuity form details with fields
      const { acuityFormsFields } = await import("@/server/db/schema/acuity");

      const acuityFieldsData = await db
        .select()
        .from(acuityFormsFields)
        .where(eq(acuityFormsFields.formId, acuityFormId));

      // Create a map of Acuity fields for easy lookup
      const acuityFieldsMap = new Map(acuityFieldsData.map((field) => [field.id, field]));

      // Group fields by form and include Acuity field details
      const formData = appFormWithFields[0].form;
      const fields = appFormWithFields
        .filter((row) => row.fields !== null)
        .map((row) => {
          const acuityField = acuityFieldsMap.get(row.fields!.acuityFieldId);
          return {
            ...row.fields!,
            acuityField: acuityField
              ? {
                  id: acuityField.id,
                  name: acuityField.name,
                  type: acuityField.type,
                  options: acuityField.options as string[] | undefined,
                  required: acuityField.required,
                }
              : undefined,
          };
        })
        .sort((a, b) => a.displayOrder - b.displayOrder);

      // Get the Acuity form details
      const [acuityForm] = await db
        .select()
        .from(acuityForms)
        .where(eq(acuityForms.id, acuityFormId));

      const result = {
        ...formData,
        fields,
        acuityForm: acuityForm
          ? {
              id: acuityForm.id,
              name: acuityForm.name,
              description: acuityForm.description,
            }
          : null,
      };

      // Audit log
      logger.audit(
        "view_appointment_type_form",
        user.id,
        "appointment_type_form",
        `${specialistId}_${appointmentTypeId}`,
        {
          specialistId,
          appointmentTypeId,
          formId: formData?.id,
        }
      );

      return c.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error("Failed to get appointment type form", error as Error);
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Failed to retrieve form",
        },
        500
      );
    }
  })

  // PUT /api/specialists/:id/appointment-types/:typeId - Update specialist appointment type configuration
  .put(
    "/:id/appointment-types/:typeId",
    requireRole("admin"),
    arktypeValidator(
      "json",
      type({
        "enabled?": "boolean",
        "appointmentMode?": "'in-person'|'telehealth'",
        "customDisplayName?": "string | null",
        "customDescription?": "string | null",
        "customPrice?": "number | null",
        "notes?": "string | null",
      })
    ),
    async (c) => {
      try {
        const authContext = c.get("auth");
        const adminUser = authContext?.user;
        if (!adminUser) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const specialistId = c.req.param("id");
        const appointmentTypeId = parseInt(c.req.param("typeId"), 10);
        const updates = c.req.valid("json");

        if (isNaN(appointmentTypeId)) {
          return c.json(
            {
              success: false,
              error: "Invalid appointment type ID",
            },
            400
          );
        }

        // Import db and schema at the top of the file if not already imported
        const { db } = await import("@/server/db");
        const { specialistAppointmentTypes } = await import("@/server/db/schema/specialists");
        const { eq, and } = await import("drizzle-orm");

        // Check if the specialist appointment type exists
        const [existing] = await db
          .select()
          .from(specialistAppointmentTypes)
          .where(
            and(
              eq(specialistAppointmentTypes.specialistId, specialistId),
              eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypeId)
            )
          );

        if (!existing) {
          return c.json(
            {
              success: false,
              error: "Specialist appointment type not found",
            },
            404
          );
        }

        // Update the specialist appointment type
        const [updated] = await db
          .update(specialistAppointmentTypes)
          .set({
            ...updates,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(specialistAppointmentTypes.specialistId, specialistId),
              eq(specialistAppointmentTypes.appointmentTypeId, appointmentTypeId)
            )
          )
          .returning();

        // Audit log the update
        logger.audit(
          "update_specialist_appointment_type",
          adminUser.id,
          "specialist_appointment_type",
          `${specialistId}_${appointmentTypeId}`,
          {
            specialistId,
            appointmentTypeId,
            updates: Object.keys(updates),
            oldValues: existing,
            newValues: updates,
          }
        );

        logger.info("Specialist appointment type updated", {
          specialistId,
          appointmentTypeId,
          updates: Object.keys(updates),
        });

        return c.json({
          success: true,
          data: updated,
          message: "Appointment type configuration updated successfully",
        });
      } catch (error) {
        logger.error("Failed to update specialist appointment type", error as Error);
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to update appointment type",
          },
          500
        );
      }
    }
  )

  // GET /api/specialists/:id/time-slots - Get time slots for a specific date
  .get(
    "/:id/time-slots",
    arktypeValidator(
      "query",
      type({
        date: "string.date",
        appointmentTypeId: "string",
        "timezone?": "string",
      })
    ),
    async (c) => {
      try {
        const authContext = c.get("auth");
        const user = authContext?.user;
        if (!user) {
          return c.json({ error: "Unauthorized" }, 401);
        }

        const specialistId = c.req.param("id");
        const { date, appointmentTypeId, timezone } = c.req.valid("query");

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

        // Fetch time slots for the specific date
        const times = await acuityService.getAvailabilityTimes({
          appointmentTypeId: parseInt(appointmentTypeId, 10),
          calendarId: specialistData.specialist.acuityCalendarId,
          date,
          timezone,
        });

        // Transform to a simpler format for the frontend
        const timeSlots = times.map((slot) => ({
          datetime: slot.time, // The time field contains the full ISO datetime
          appointmentTypeId: parseInt(appointmentTypeId, 10),
        }));

        // Audit log the time slots access
        logger.audit("view_specialist_time_slots", user.id, "specialist", specialistId, {
          userRole: user.role,
          date,
          appointmentTypeId,
          timezone,
          slotsFound: timeSlots.length,
        });

        return c.json({
          success: true,
          data: {
            specialistId: specialistData.specialist.id,
            date,
            timeSlots,
          },
        });
      } catch (error) {
        logger.error("Failed to get specialist time slots", error as Error);
        return c.json(
          {
            success: false,
            error: error instanceof Error ? error.message : "Failed to retrieve time slots",
          },
          500
        );
      }
    }
  );

export { specialistsRoutes };
