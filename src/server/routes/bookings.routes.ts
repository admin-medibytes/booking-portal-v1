import { Hono } from "hono";
import { bookingService } from "@/server/services/booking.service";
import { authMiddleware, requireAuth } from "@/server/middleware/auth.middleware";
import { bookingCreateRateLimit } from "@/server/middleware/rate-limit.middleware";
import type { BookingFilters } from "@/types/booking";
import { type } from "arktype";

const bookingsRoutes = new Hono();

// Apply auth middleware to all routes
bookingsRoutes.use("*", authMiddleware);
bookingsRoutes.use("*", requireAuth);

// Validation schemas with enhanced ArkType features
const bookingFiltersSchema = type({
  "status?": "'active' | 'closed' | 'archived'",
  "startDate?": "string.date",
  "endDate?": "string.date",
  "specialistId?": "string.uuid",
  "page?": "string.integer",
  "limit?": "string.integer<=100",
});

// Validation schema for creating a booking
const createBookingSchema = type({
  specialistId: "string.uuid",
  appointmentDateTime: "string.date",
  examineeName: "string>0",
  examineePhone: "string>0",
  "examineeEmail?": "string.email|null",
  appointmentType: "'in_person'|'telehealth'",
  "notes?": "string|null",
});

// Validation schema for updating progress
const updateProgressSchema = type({
  progress:
    "'scheduled'|'rescheduled'|'cancelled'|'no-show'|'generating-report'|'report-generated'|'payment-received'",
  "notes?": "string|null",
});

// GET /api/bookings - List bookings with role-based filtering
bookingsRoutes.get("/", async (c) => {
  try {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Ensure role is properly typed
    const typedUser = {
      id: user.id,
      role: user.role as "user" | "admin" | null,
    };

    // Get query parameters
    const query = c.req.query();

    // Validate query parameters
    const validationResult = bookingFiltersSchema(query);
    if (validationResult instanceof type.errors) {
      return c.json(
        {
          error: "Invalid query parameters",
          details: validationResult[0].message,
        },
        400
      );
    }

    // Convert and prepare filters - ArkType has already parsed the values
    const filters: BookingFilters = {
      status: validationResult.status,
      startDate: validationResult.startDate ? new Date(validationResult.startDate) : undefined,
      endDate: validationResult.endDate ? new Date(validationResult.endDate) : undefined,
      specialistId: validationResult.specialistId,
      page: Number(validationResult.page) ?? 1,
      limit: Number(validationResult.limit) ?? 20,
    };

    const result = await bookingService.getBookingsForUser(typedUser, filters);

    return c.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return c.json(
      {
        error: "Failed to fetch bookings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// GET /api/bookings/:id - Get single booking details
bookingsRoutes.get("/:id", async (c) => {
  try {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Ensure role is properly typed
    const typedUser = {
      id: user.id,
      role: user.role as "user" | "admin" | null,
    };

    const bookingId = c.req.param("id");

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      return c.json({ error: "Invalid booking ID format" }, 400);
    }

    const booking = await bookingService.getBookingById(bookingId, typedUser);

    return c.json({
      success: true,
      booking,
    });
  } catch (error) {
    console.error("Error fetching booking:", error);

    if (error instanceof Error) {
      if (error.name === "BookingNotFoundError") {
        return c.json({ error: "Booking not found" }, 404);
      }
      if (error.name === "AccessDeniedError") {
        return c.json({ error: "Access denied" }, 403);
      }
    }

    return c.json(
      {
        error: "Failed to fetch booking",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// POST /api/bookings - Create a new booking
bookingsRoutes.post("/", bookingCreateRateLimit, async (c) => {
  try {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Get request body
    const body = await c.req.json();

    // Validate request body
    const validationResult = createBookingSchema(body);
    if (validationResult instanceof type.errors) {
      return c.json(
        {
          error: "Invalid request body",
          details: validationResult[0].message,
        },
        400
      );
    }

    // Create booking
    const booking = await bookingService.createBooking({
      ...validationResult,
      appointmentDateTime: new Date(validationResult.appointmentDateTime),
      referrerId: user.id,
    });

    return c.json(
      {
        success: true,
        id: booking.id,
        message: "Booking created successfully",
      },
      201
    );
  } catch (error) {
    console.error("Error creating booking:", error);

    if (error instanceof Error) {
      if (error.message.includes("Specialist not found")) {
        return c.json({ error: "Specialist not found" }, 404);
      }
      if (error.message.includes("Time slot not available")) {
        return c.json({ error: "Time slot is no longer available" }, 409);
      }
      if (error.message.includes("Acuity")) {
        return c.json({ error: "Failed to sync with scheduling system" }, 503);
      }
    }

    return c.json(
      {
        error: "Failed to create booking",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

// POST /api/bookings/:id/progress - Update booking progress
bookingsRoutes.post("/:id/progress", async (c) => {
  try {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const bookingId = c.req.param("id");
    const body = await c.req.json();

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      return c.json({ error: "Invalid booking ID format" }, 400);
    }

    // Validate request body
    const validationResult = updateProgressSchema(body);
    if (validationResult instanceof type.errors) {
      return c.json(
        {
          error: "Invalid request body",
          details: validationResult[0].message,
        },
        400
      );
    }

    // Get user's organization role if any
    const organizationRole = authContext.session?.activeOrganizationId
      ? await bookingService.getUserOrganizationRole(
          user.id,
          authContext.session.activeOrganizationId
        )
      : undefined;

    // Update booking progress
    const booking = await bookingService.updateBookingProgress(
      bookingId,
      validationResult.progress,
      {
        userId: user.id,
        userRole: user.role as "user" | "admin" | null,
        organizationRole,
        notes: validationResult.notes,
        impersonatedUserId: authContext.session?.impersonatedBy || undefined,
      }
    );

    return c.json({
      success: true,
      booking,
      message: "Progress updated successfully",
    });
  } catch (error) {
    console.error("Error updating booking progress:", error);

    if (error instanceof Error) {
      if (error.name === "BookingNotFoundError") {
        return c.json({ error: "Booking not found" }, 404);
      }
      if (error.name === "AccessDeniedError") {
        return c.json({ error: "Access denied" }, 403);
      }
      if (error.name === "InvalidTransitionError") {
        return c.json({ error: error.message }, 400);
      }
    }

    return c.json(
      {
        error: "Failed to update booking progress",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

export { bookingsRoutes };
