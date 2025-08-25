import { Hono } from "hono";
import { type } from "arktype";
import { authMiddleware, requireAuth, requireRole } from "@/server/middleware/auth.middleware";
import { arktypeValidator } from "@/server/middleware/validate.middleware";
import {
  specialistRepository,
  type UpdateSpecialistInputType,
  type UpdatePositionsInputType,
} from "@/server/repositories/specialist.repository";
import { acuityService } from "@/server/services/acuity.service";
import { logger } from "@/server/utils/logger";
import type { SpecialistAvailabilityResponse } from "@/types/acuity";

// Helper function for role-based field filtering
function getSpecialistFields(
  user: { id: string; role?: string | null },
  specialist: {
    id: string;
    userId: string;
    acuityCalendarId: string;
    name: string;
    location: string | null;
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
    location: specialist.location,
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

const updateSpecialistSchema = type({
  "name?": "string",
  "location?": "string | null",
  "isActive?": "boolean",
});

const specialistsRoutes = new Hono()

  // Apply auth middleware to all routes
  .use("*", authMiddleware)
  .use("*", requireAuth)

  // GET /api/specialists - List all active specialists
  .get("/", async (c) => {
    try {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const includeInactive = c.req.query("includeInactive") === "true";

      // Audit log the access
      logger.audit("view_specialist_list", user.id, "specialist", "list", {
        includeInactive,
        userRole: user.role,
      });

      const specialists = includeInactive
        ? await specialistRepository.findAll()
        : await specialistRepository.findAllActive();

      return c.json({
        success: true,
        data: specialists.map(({ specialist, user: specialistUser }) =>
          getSpecialistFields(user, specialist, specialistUser)
        ),
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

        // Create specialist profile
        const specialist = await specialistRepository.create({
          userId: data.userId,
          acuityCalendarId: data.acuityCalendarId,
          name: acuityCalendar.name,
          location: null, // Default to telehealth
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
    arktypeValidator("json", updateSpecialistSchema),
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

        // Update specialist
        const updated = await specialistRepository.update(
          id,
          updateData as UpdateSpecialistInputType
        );

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

  // GET /api/specialists/:id/availability - Get specialist availability
  .get("/:id/appointment-types", async (c) => {
    try {
      const authContext = c.get("auth");
      const specialistId = c.req.param("id");

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

      // Fetch appointment types from Acuity
      const appointmentTypes = await acuityService.getAppointmentTypes();

      // Return appointment types with relevant information
      return c.json({
        success: true,
        data: appointmentTypes.map((type) => ({
          id: type.id,
          name: type.name,
          duration: type.duration,
          description: type.description,
          category: type.category,
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
