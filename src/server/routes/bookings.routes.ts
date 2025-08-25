import { Hono } from "hono";
import { type } from "arktype";
import { bookingService } from "@/server/services/booking.service";
import { authMiddleware, requireAuth } from "@/server/middleware/auth.middleware";
import { bookingCreateRateLimit } from "@/server/middleware/rate-limit.middleware";
import { arktypeValidator } from "@/server/middleware/validate.middleware";
import type { BookingFilters } from "@/types/booking";

const bookingFiltersSchema = type({
  "status?": "'active' | 'closed' | 'archived'",
  "startDate?": "string.date",
  "endDate?": "string.date",
  "specialistId?": "string.uuid",
  "page?": "string.integer",
  "limit?": "string.integer<=100",
});

const updateProgressSchema = type({
  progress:
    "'scheduled'|'rescheduled'|'cancelled'|'no-show'|'generating-report'|'report-generated'|'payment-received'",
  "notes?": "string|null",
});

const bookingsRoutes = new Hono()

  // Apply auth middleware to all routes
  .use("*", authMiddleware)
  .use("*", requireAuth)

  // GET /api/bookings - List bookings with role-based filtering
  .get("/", arktypeValidator("query", bookingFiltersSchema), async (c) => {
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

    // Validate query parameters
    const queryParams = c.req.valid("query");

    // Convert and prepare filters - ArkType has already parsed the values
    const filters: BookingFilters = {
      status: queryParams.status,
      startDate: queryParams.startDate ? new Date(queryParams.startDate) : undefined,
      endDate: queryParams.endDate ? new Date(queryParams.endDate) : undefined,
      specialistId: queryParams.specialistId,
      page: Number(queryParams.page) ?? 1,
      limit: Number(queryParams.limit) ?? 20,
    };

    const result = await bookingService.getBookingsForUser(typedUser, filters);

    return c.json({
      success: true,
      ...result,
    });
  })

  // GET /api/bookings/:id - Get single booking details
  .get("/:id", async (c) => {
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
  })

  // POST /api/bookings - Create a new booking
  .post(
    "/",
    arktypeValidator(
      "json",
      type({
        specialistId: "string.uuid",
        appointmentDateTime: "string.date",
        examineeName: "string>0",
        examineePhone: "string>0",
        "examineeEmail?": "string.email|null",
        appointmentType: "'in_person'|'telehealth'",
        "notes?": "string|null",
      })
    ),
    bookingCreateRateLimit,
    async (c) => {
      const authContext = c.get("auth");
      const user = authContext?.user;
      if (!user) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Validate request body
      const input = c.req.valid("json");

      // Create booking
      const booking = await bookingService.createBooking({
        ...input,
        appointmentDateTime: new Date(input.appointmentDateTime),
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
    }
  )

  // POST /api/bookings/:id/progress - Update booking progress
  .post("/:id/progress", arktypeValidator("json", updateProgressSchema), async (c) => {
    const authContext = c.get("auth");
    const user = authContext?.user;
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const bookingId = c.req.param("id");

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(bookingId)) {
      return c.json({ error: "Invalid booking ID format" }, 400);
    }

    // Validate request body
    const input = c.req.valid("json");

    // Get user's organization role if any
    const organizationRole = authContext.session?.activeOrganizationId
      ? await bookingService.getUserOrganizationRole(
          user.id,
          authContext.session.activeOrganizationId
        )
      : undefined;

    // Update booking progress
    const booking = await bookingService.updateBookingProgress(bookingId, input.progress, {
      userId: user.id,
      userRole: user.role as "user" | "admin" | null,
      organizationRole,
      notes: input.notes,
      impersonatedUserId: authContext.session?.impersonatedBy || undefined,
    });

    return c.json({
      success: true,
      booking,
      message: "Progress updated successfully",
    });
  });

export { bookingsRoutes };
