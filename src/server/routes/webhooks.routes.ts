import { Hono } from "hono";
import { type } from "arktype";
import { acuityService } from "@/server/services/acuity.service";
import { bookingService } from "@/server/services/booking.service";
import { db } from "@/server/db";
import { webhookEvents } from "@/server/db/schema";
import { logger } from "@/server/utils/logger";
import { invalidateAvailabilityCache } from "@/lib/redis";

const webhooksRoutes = new Hono();

// Webhook event schema
const AcuityWebhookPayload = type({
  id: "number",
  action: "'scheduled' | 'rescheduled' | 'canceled' | 'changed'",
  calendarID: "number",
  appointmentTypeID: "number",
  datetime: "string",
  firstName: "string",
  lastName: "string",
  email: "string.email",
  "phone?": "string",
  "notes?": "string",
});

// POST /webhooks/acuity - Handle Acuity webhook events
webhooksRoutes.post("/acuity", async (c) => {
  try {
    // Get the raw body for signature validation
    const rawBody = await c.req.text();
    const signature = c.req.header("X-Acuity-Signature");
    const timestamp = c.req.header("X-Acuity-Timestamp");
    
    if (!signature) {
      logger.warn("Acuity webhook received without signature");
      return c.json({ error: "Missing signature" }, 401);
    }
    
    // Validate timestamp to prevent replay attacks (5 minute window)
    if (timestamp) {
      const webhookTime = parseInt(timestamp, 10);
      const currentTime = Math.floor(Date.now() / 1000);
      const timeDiff = Math.abs(currentTime - webhookTime);
      
      if (isNaN(webhookTime) || timeDiff > 300) { // 5 minutes
        logger.warn("Acuity webhook timestamp validation failed", {
          webhookTime,
          currentTime,
          timeDiff,
        });
        logger.audit("webhook_security_event", "system", "webhook", "acuity", {
          event: "timestamp_validation_failed",
          timeDiff,
        });
        return c.json({ error: "Invalid or expired timestamp" }, 401);
      }
    }
    
    // Validate signature (include timestamp in signature if provided)
    const payloadToVerify = timestamp ? `${timestamp}.${rawBody}` : rawBody;
    const isValid = acuityService.validateWebhookSignature(payloadToVerify, signature);
    if (!isValid) {
      logger.warn("Invalid Acuity webhook signature", {
        hasTimestamp: !!timestamp,
      });
      logger.audit("webhook_security_event", "system", "webhook", "acuity", {
        event: "signature_validation_failed",
        hasTimestamp: !!timestamp,
      });
      return c.json({ error: "Invalid signature" }, 401);
    }
    
    // Parse the payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      logger.error("Failed to parse webhook payload", error as Error);
      return c.json({ error: "Invalid payload" }, 400);
    }
    
    // Validate payload structure
    const validated = AcuityWebhookPayload(payload);
    if (validated instanceof type.errors) {
      logger.error("Invalid webhook payload structure", undefined, { 
        errors: validated.map(e => ({ path: e.path, message: e.message })),
        payload 
      });
      return c.json({ error: "Invalid payload structure" }, 400);
    }
    
    // Store the webhook event
    const [webhookEvent] = await db
      .insert(webhookEvents)
      .values({
        source: "acuity",
        eventType: validated.action,
        resourceId: validated.id.toString(),
        payload: payload as Record<string, unknown>,
      })
      .returning();
    
    logger.info("Acuity webhook event received", {
      webhookEventId: webhookEvent.id,
      action: validated.action,
      appointmentId: validated.id,
      calendarId: validated.calendarID,
      timestamp: timestamp || "not provided",
    });
    
    // Process the webhook based on action
    try {
      switch (validated.action) {
        case "scheduled":
          await handleAppointmentScheduled(validated);
          break;
          
        case "rescheduled":
          await handleAppointmentRescheduled(validated);
          break;
          
        case "canceled":
          await handleAppointmentCanceled(validated);
          break;
          
        case "changed":
          await handleAppointmentChanged(validated);
          break;
          
        default:
          logger.warn("Unknown webhook action", { action: validated.action });
      }
      
      // Mark webhook as processed
      await db
        .update(webhookEvents)
        .set({ processedAt: new Date() })
        .where(eq(webhookEvents.id, webhookEvent.id));
        
      // Invalidate availability cache for the affected calendar
      await invalidateAvailabilityCache(validated.calendarID.toString());
      
    } catch (error) {
      // Store error in webhook event
      await db
        .update(webhookEvents)
        .set({ 
          error: error instanceof Error ? error.message : "Unknown error",
          processedAt: new Date(),
        })
        .where(eq(webhookEvents.id, webhookEvent.id));
        
      logger.error("Failed to process webhook", error as Error, { 
        webhookEventId: webhookEvent.id 
      });
      
      // Still return 200 to Acuity to prevent retries
      return c.json({ 
        success: true, 
        message: "Webhook received but processing failed" 
      });
    }
    
    return c.json({ success: true, message: "Webhook processed successfully" });
    
  } catch (error) {
    logger.error("Webhook handler error", error as Error);
    // Return 200 to prevent Acuity from retrying
    return c.json({ 
      success: true, 
      message: "Webhook received but an error occurred" 
    });
  }
});

// Handler functions for different webhook actions
async function handleAppointmentScheduled(data: typeof AcuityWebhookPayload.infer) {
  logger.info("Processing scheduled appointment webhook", {
    appointmentId: data.id,
    calendarId: data.calendarID,
    datetime: data.datetime,
  });
  
  // Find booking by Acuity appointment ID if it exists
  // This might be a booking created through our system
  try {
    const booking = await bookingService.findByAcuityAppointmentId(data.id.toString());
    if (booking) {
      // Update booking status to ensure it's synced
      await bookingService.updateBookingStatus(booking.id, "active");
      logger.info("Updated booking status for scheduled appointment", { bookingId: booking.id });
    }
  } catch (error) {
    logger.error("Failed to update booking for scheduled appointment", error as Error, { appointmentId: data.id });
  }
}

async function handleAppointmentRescheduled(data: typeof AcuityWebhookPayload.infer) {
  logger.info("Processing rescheduled appointment webhook", {
    appointmentId: data.id,
    calendarId: data.calendarID,
    datetime: data.datetime,
  });
  
  try {
    const booking = await bookingService.findByAcuityAppointmentId(data.id.toString());
    if (booking) {
      // Update booking with new exam date/time
      await bookingService.updateBookingExamDate(booking.id, new Date(data.datetime));
      logger.info("Updated booking exam date for rescheduled appointment", { bookingId: booking.id });
    }
  } catch (error) {
    logger.error("Failed to update booking for rescheduled appointment", error as Error, { appointmentId: data.id });
  }
}

async function handleAppointmentCanceled(data: typeof AcuityWebhookPayload.infer) {
  logger.info("Processing canceled appointment webhook", {
    appointmentId: data.id,
    calendarId: data.calendarID,
  });
  
  try {
    const booking = await bookingService.findByAcuityAppointmentId(data.id.toString());
    if (booking) {
      // Update booking status to closed
      await bookingService.updateBookingStatus(booking.id, "closed");
      logger.info("Updated booking status for canceled appointment", { bookingId: booking.id });
    }
  } catch (error) {
    logger.error("Failed to update booking for canceled appointment", error as Error, { appointmentId: data.id });
  }
}

async function handleAppointmentChanged(data: typeof AcuityWebhookPayload.infer) {
  logger.info("Processing changed appointment webhook", {
    appointmentId: data.id,
    calendarId: data.calendarID,
  });
  
  try {
    const booking = await bookingService.findByAcuityAppointmentId(data.id.toString());
    if (booking) {
      // Fetch full appointment details from Acuity
      const appointment = await acuityService.getAppointment(data.id);
      
      // Update booking with latest info
      await bookingService.syncWithAcuityAppointment(booking.id, appointment);
      logger.info("Synced booking with changed appointment", { bookingId: booking.id });
    }
  } catch (error) {
    logger.error("Failed to update booking for changed appointment", error as Error, { appointmentId: data.id });
  }
}

// Import eq for database queries
import { eq } from "drizzle-orm";

export { webhooksRoutes };