import { Hono } from "hono";
import { type } from "arktype";
import { arktypeValidator } from "@/server/middleware/validate.middleware";
import { db } from "@/server/db";
import {
  bookings,
  bookingProgress,
  specialists,
  examinees,
  referrers,
  organizations,
  appFormFields,
  appForms,
  acuityAppointmentTypeForms
} from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/server/utils/logger";
import type { ExamineeFieldType } from "@/server/db/schema/appForms";

export { webhooksRoutes };

// Appointment creation webhook schema (from automation)
const AppointmentWebhookSchema = type({
  // Required fields
  acuityAppointmentId: "string",
  location: "string",

  // Optional fields (required for new bookings created in Acuity)
  "datetime?": "string",
  "duration?": "string",
  "acuityCalendarId?": "string",
  "acuityAppointmentTypeId?": "string",
  "type?": "string",
  "referrerFirstName?": "string",
  "referrerLastName?": "string",
  "referrerEmail?": "string",
  "referrerPhone?": "string",
  "organizationName?": "string",
  "fields?": type({
    id: "number",
    "fieldID?": "number",
    value: "string",
    "name?": "string",
  }).array(),
});

// Appointment cancellation webhook schema
const AppointmentCancellationSchema = type({
  acuityAppointmentId: "string",
});

// Appointment reschedule webhook schema
const AppointmentRescheduleSchema = type({
  acuityAppointmentId: "string",
  datetime: "string",
});

// Helper function to extract examinee data from Acuity fields using form configuration
async function extractExamineeDataFromFields(
  appointmentTypeId: number,
  fields: Array<{ id: number; fieldID?: number; value: string; name?: string }>
): Promise<Record<string, string>> {
  // Get the form configuration with field mappings
  const formMappings = await db
    .select({
      acuityFieldId: appFormFields.acuityFieldId,
      examineeFieldMapping: appFormFields.examineeFieldMapping,
    })
    .from(appFormFields)
    .innerJoin(appForms, eq(appFormFields.appFormId, appForms.id))
    .innerJoin(
      acuityAppointmentTypeForms,
      eq(appForms.acuityFormId, acuityAppointmentTypeForms.formId)
    )
    .where(
      and(
        eq(acuityAppointmentTypeForms.appointmentTypeId, appointmentTypeId),
        eq(appForms.isActive, true)
      )
    );

  // Create a map of field ID to examinee field mapping
  const fieldMappingMap = new Map<number, ExamineeFieldType>();
  formMappings.forEach((mapping) => {
    if (mapping.examineeFieldMapping) {
      fieldMappingMap.set(mapping.acuityFieldId, mapping.examineeFieldMapping);
    }
  });

  // Extract examinee data from submitted fields
  const examineeData: Record<string, string> = {};
  for (const field of fields) {
    // Try fieldID first (from Acuity), fallback to id
    const fieldId = field.fieldID ?? field.id;
    const mapping = fieldMappingMap.get(fieldId);
    if (mapping && field.value) {
      examineeData[mapping] = field.value;
    }
  }

  return examineeData;
}

const webhooksRoutes = new Hono()

  // POST /webhooks/appointment - Handle appointment creation/update from automation
  .post("/appointment", arktypeValidator("json", AppointmentWebhookSchema), async (c) => {
    try {
      const data = c.req.valid("json");
      const acuityAppointmentId = Number(data.acuityAppointmentId);

      logger.info("Appointment webhook received from automation", {
        acuityAppointmentId,
        location: data.location,
      });

      // Check if booking exists
      const existingBooking = await db.query.bookings.findFirst({
        where: eq(bookings.acuityAppointmentId, acuityAppointmentId),
      });

      if (existingBooking) {
        // Scenario 1: Booking exists - just update the location
        await db
          .update(bookings)
          .set({
            location: data.location,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, existingBooking.id));

        logger.info("Updated existing booking with location from automation", {
          bookingId: existingBooking.id,
          acuityAppointmentId,
        });

        return c.json({
          success: true,
          message: "Booking updated successfully",
          bookingId: existingBooking.id,
        });
      }

      // Scenario 2: Booking doesn't exist - create new booking
      // Validate required fields for new bookings
      if (!data.datetime || !data.duration || !data.acuityCalendarId || !data.acuityAppointmentTypeId) {
        logger.warn("Missing required fields for new booking from automation", {
          acuityAppointmentId,
          hasDatetime: !!data.datetime,
          hasDuration: !!data.duration,
          hasCalendarId: !!data.acuityCalendarId,
          hasAppointmentTypeId: !!data.acuityAppointmentTypeId,
        });

        return c.json(
          {
            success: false,
            error: "Missing required fields for new booking",
          },
          400
        );
      }

      // Find specialist by Acuity calendar ID
      const specialist = await db.query.specialists.findFirst({
        where: eq(specialists.acuityCalendarId, Number(data.acuityCalendarId)),
      });

      if (!specialist) {
        logger.error("Specialist not found for calendar ID from automation",  undefined, {
          acuityCalendarId: data.acuityCalendarId,
        });

        return c.json(
          {
            success: false,
            error: "Specialist not found",
          },
          404
        );
      }

      // Extract examinee data from fields using form configuration
      const examineeData = await extractExamineeDataFromFields(
        Number(data.acuityAppointmentTypeId),
        data.fields || []
      );

      // Find or create organization
      let organizationId: string;
      if (data.organizationName) {
        const slug = data.organizationName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const existingOrg = await db.query.organizations.findFirst({
          where: eq(organizations.slug, slug),
        });

        if (existingOrg) {
          organizationId = existingOrg.id;
          logger.info("Found existing organization", { organizationId, slug });
        } else {
          // Use default organization - you should configure this
        organizationId = process.env.DEFAULT_ORGANIZATION_ID || "default";
        logger.warn("No organization name provided, using default", { organizationId });
        }
      } else {
        // Use default organization - you should configure this
        organizationId = process.env.DEFAULT_ORGANIZATION_ID || "default";
        logger.warn("No organization name provided, using default", { organizationId });
      }

      // Create or find referrer
      let referrerId: string;
      if (data.referrerEmail) {
        const existingReferrer = await db.query.referrers.findFirst({
          where: eq(referrers.email, data.referrerEmail),
        });

        if (existingReferrer) {
          referrerId = existingReferrer.id;
          logger.info("Found existing referrer", { referrerId, email: data.referrerEmail });
        } else {
          const [newReferrer] = await db
            .insert(referrers)
            .values({
              firstName: data.referrerFirstName || "",
              lastName: data.referrerLastName || "",
              email: data.referrerEmail,
              phone: data.referrerPhone || "",
              organizationId,
            })
            .returning();
          referrerId = newReferrer.id;
          logger.info("Created new referrer", { referrerId, email: data.referrerEmail });
        }
      } else {
        // Create anonymous referrer if no email provided
        const timestamp = Date.now();
        const [newReferrer] = await db
          .insert(referrers)
          .values({
            firstName: data.referrerFirstName || "Unknown",
            lastName: data.referrerLastName || "Referrer",
            email: `unknown-${timestamp}@placeholder.com`,
            phone: "",
            organizationId,
          })
          .returning();
        referrerId = newReferrer.id;
        logger.info("Created anonymous referrer", { referrerId });
      }

      // Validate examinee data has required fields
      const missingFields: string[] = [];
      if (!examineeData.firstName) missingFields.push("firstName");
      if (!examineeData.lastName) missingFields.push("lastName");
      if (!examineeData.dateOfBirth) missingFields.push("dateOfBirth");
      if (!examineeData.address) missingFields.push("address");
      if (!examineeData.condition) missingFields.push("condition");
      if (!examineeData.caseType) missingFields.push("caseType");

      if (missingFields.length > 0) {
        logger.error("Missing required examinee fields from form data", undefined, {
          acuityAppointmentId,
          missingFields,
          extractedFields: Object.keys(examineeData),
          appointmentTypeId: data.acuityAppointmentTypeId,
        });

        return c.json(
          {
            success: false,
            error: `Missing required examinee fields: ${missingFields.join(", ")}. Please check form field mappings.`,
          },
          400
        );
      }

      // Create examinee with extracted data
      const [examinee] = await db
        .insert(examinees)
        .values({
          referrerId,
          firstName: examineeData.firstName,
          lastName: examineeData.lastName,
          dateOfBirth: examineeData.dateOfBirth,
          address: examineeData.address,
          email: examineeData.email || "n/a",
          phoneNumber: examineeData.phoneNumber || "",
          authorizedContact: examineeData.authorizedContact === "yes",
          condition: examineeData.condition,
          caseType: examineeData.caseType,
        })
        .returning();

      logger.info("Created examinee", {
        examineeId: examinee.id,
        name: `${examinee.firstName} ${examinee.lastName}`,
        extractedFields: Object.keys(examineeData)
      });

      // Determine appointment type
      const appointmentType = data.type?.toLowerCase().includes("telehealth")
        ? "telehealth"
        : "in-person";

      // Get system user ID for creator
      const systemUserId = process.env.SYSTEM_USER_ID || "system";

      // Create booking
      const [newBooking] = await db
        .insert(bookings)
        .values({
          acuityAppointmentId,
          acuityAppointmentTypeId: Number(data.acuityAppointmentTypeId),
          acuityCalendarId: Number(data.acuityCalendarId),
          dateTime: new Date(data.datetime),
          duration: Number(data.duration),
          type: appointmentType,
          location: data.location,
          specialistId: specialist.id,
          examineeId: examinee.id,
          referrerId,
          organizationId,
          createdById: systemUserId,
          status: "active",
        })
        .returning();

      logger.info("Created new booking from automation webhook", {
        bookingId: newBooking.id,
        acuityAppointmentId,
        examineeId: examinee.id,
        specialistId: specialist.id,
      });

      return c.json({
        success: true,
        message: "Booking created successfully",
        bookingId: newBooking.id,
      }, 201);

    } catch (error) {
      logger.error("Appointment webhook error", undefined, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Internal server error",
        },
        500
      );
    }
  })

  // DELETE /webhooks/appointment - Handle appointment cancellation from Acuity
  .delete("/appointment", arktypeValidator("json", AppointmentCancellationSchema), async (c) => {
    try {
      const data = c.req.valid("json");
      const acuityAppointmentId = Number(data.acuityAppointmentId);

      logger.info("Appointment cancellation webhook received", {
        acuityAppointmentId,
      });

      // Find booking by Acuity appointment ID
      const existingBooking = await db.query.bookings.findFirst({
        where: eq(bookings.acuityAppointmentId, acuityAppointmentId),
      });

      if (!existingBooking) {
        logger.warn("Booking not found for cancellation", {
          acuityAppointmentId,
        });

        return c.json(
          {
            success: false,
            error: "Booking not found",
          },
          404
        );
      }

      // Update booking status to closed and set cancelledAt timestamp
      await db
        .update(bookings)
        .set({
          status: "closed",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, existingBooking.id));

      logger.info("Booking marked as closed due to cancellation", {
        bookingId: existingBooking.id,
        acuityAppointmentId,
      });

      return c.json({
        success: true,
        message: "Booking cancelled successfully",
        bookingId: existingBooking.id,
      });

    } catch (error) {
      logger.error("Appointment cancellation webhook error", undefined, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Internal server error",
        },
        500
      );
    }
  })

  // PUT /webhooks/appointment - Handle appointment reschedule from Acuity
  .put("/appointment", arktypeValidator("json", AppointmentRescheduleSchema), async (c) => {
    try {
      const data = c.req.valid("json");
      const acuityAppointmentId = Number(data.acuityAppointmentId);
      const newDateTime = new Date(data.datetime);

      logger.info("Appointment reschedule webhook received", {
        acuityAppointmentId,
        newDateTime: data.datetime,
      });

      // Validate datetime
      if (isNaN(newDateTime.getTime())) {
        logger.warn("Invalid datetime format in reschedule webhook", {
          acuityAppointmentId,
          datetime: data.datetime,
        });

        return c.json(
          {
            success: false,
            error: "Invalid datetime format",
          },
          400
        );
      }

      // Find booking by Acuity appointment ID
      const existingBooking = await db.query.bookings.findFirst({
        where: eq(bookings.acuityAppointmentId, acuityAppointmentId),
        columns: {
          id: true,
          dateTime: true,
          status: true,
        },
        with: {
          progress: {
            orderBy: (progress, { desc }) => [desc(progress.createdAt)],
            limit: 1,
          },
        },
      });

      if (!existingBooking) {
        logger.warn("Booking not found for reschedule", {
          acuityAppointmentId,
        });

        return c.json(
          {
            success: false,
            error: "Booking not found",
          },
          404
        );
      }

      // Get system user ID for creator
      const systemUserId = process.env.SYSTEM_USER_ID || "system";

      // Get current progress status
      const currentProgress = existingBooking.progress[0]?.toStatus || "scheduled";

      // Update booking datetime and create progress entry in a transaction
      await db.transaction(async (tx) => {
        // Update booking datetime
        await tx
          .update(bookings)
          .set({
            dateTime: newDateTime,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, existingBooking.id));

        // Create progress entry for reschedule
        await tx.insert(bookingProgress).values({
          bookingId: existingBooking.id,
          fromStatus: currentProgress,
          toStatus: "rescheduled",
          changedById: systemUserId,
        });
      });

      logger.info("Booking rescheduled successfully", {
        bookingId: existingBooking.id,
        acuityAppointmentId,
        previousDateTime: existingBooking.dateTime,
        newDateTime: data.datetime,
      });

      return c.json({
        success: true,
        message: "Booking rescheduled successfully",
        bookingId: existingBooking.id,
      });

    } catch (error) {
      logger.error("Appointment reschedule webhook error", undefined, {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Internal server error",
        },
        500
      );
    }
  });
