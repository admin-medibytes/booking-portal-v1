import { env } from "@/lib/env";
import { type } from "arktype";
import pino from "pino";
import crypto from "crypto";
import {
  cacheAvailability,
  getCachedAvailability,
  cacheAppointmentTypes,
  getCachedAppointmentTypes,
  invalidateAvailabilityCache,
} from "@/lib/redis";

const logger = pino({ name: "acuity.service" });

// Acuity API response types
export const AcuityCalendar = type({
  id: "number",
  name: "string",
  email: "string.email",
  description: "string | undefined",
  timezone: "string",
  thumbnail: "string | undefined",
  replyTo: "string.email | undefined",
});

export const AcuityTimeSlot = type({
  time: "string",
  date: "string",
  datetime: "string",
  duration: "number",
  slotsAvailable: "number",
  calendarID: "number",
  appointmentTypeID: "number",
  canBook: "boolean",
});

// Actual response from /availability/times endpoint
export const AcuityAvailabilityTime = type({
  time: "string", // ISO datetime like "2016-02-04T13:00:00-0800"
});

export const AcuityAppointmentType = type({
  id: "number",
  name: "string",
  duration: "number",
  price: "string",
  category: "string",
  description: "string | undefined",
  color: "string",
  private: "boolean",
  type: "string",
  calendarIDs: "number[]",
});

export const AcuityFormField = type({
  id: "number",
  name: "string",
  options: "string[] | null",
  required: "boolean",
  type: "'textbox' | 'textarea' | 'dropdown' | 'checkbox' | 'checkboxlist' | 'yesno' | 'file' | 'address'",
});

export const AcuityForm = type({
  id: "number",
  appointmentTypeIDs: "number[]",
  description: "string",
  hidden: "boolean",
  name: "string",
  fields: "unknown[]", // Will be validated as AcuityFormField[] separately
});

export const AcuityAppointment = type({
  id: "number",
  firstName: "string",
  lastName: "string",
  phone: "string | undefined",
  email: "string.email",
  date: "string",
  time: "string",
  datetime: "string",
  duration: "string",
  price: "string",
  paid: "string",
  amountPaid: "string",
  type: "string",
  appointmentTypeID: "number",
  calendarID: "number",
  canClientCancel: "boolean",
  canClientReschedule: "boolean",
  notes: "string | undefined",
  forms: "unknown[] | undefined",
});

export type AcuityCalendarType = typeof AcuityCalendar.infer;
export type AcuityTimeSlotType = typeof AcuityTimeSlot.infer;
export type AcuityAvailabilityTimeType = typeof AcuityAvailabilityTime.infer;
export type AcuityAppointmentTypeType = typeof AcuityAppointmentType.infer;
export type AcuityAppointmentType = typeof AcuityAppointment.infer;
export type AcuityFormFieldType = typeof AcuityFormField.infer;
export type AcuityFormType = typeof AcuityForm.infer;

// Rate limiting state
interface RateLimitState {
  requestsThisSecond: number;
  requestsThisHour: number;
  secondResetTime: number;
  hourResetTime: number;
}

// Acuity API error
export class AcuityAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "AcuityAPIError";
  }
}

export class AcuityService {
  private baseUrl: string;
  private authHeader: string;
  private rateLimitPerSecond: number;
  private rateLimitPerHour: number;
  private rateLimitState: RateLimitState;
  private requestTimeout: number = 30000; // 30 seconds

  constructor() {
    this.baseUrl = env.ACUITY_BASE_URL;
    const authString = `${env.ACUITY_USER_ID}:${env.ACUITY_API_KEY}`;
    this.authHeader = `Basic ${btoa(authString)}`;
    this.rateLimitPerSecond = Number(env.ACUITY_RATE_LIMIT_PER_SECOND);
    this.rateLimitPerHour = Number(env.ACUITY_RATE_LIMIT_PER_HOUR);

    this.rateLimitState = {
      requestsThisSecond: 0,
      requestsThisHour: 0,
      secondResetTime: Date.now() + 1000,
      hourResetTime: Date.now() + 3600000,
    };
  }

  // Rate limiting logic
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset counters if time windows have passed
    if (now >= this.rateLimitState.secondResetTime) {
      this.rateLimitState.requestsThisSecond = 0;
      this.rateLimitState.secondResetTime = now + 1000;
    }

    if (now >= this.rateLimitState.hourResetTime) {
      this.rateLimitState.requestsThisHour = 0;
      this.rateLimitState.hourResetTime = now + 3600000;
    }

    // Check if we're at the rate limit
    if (this.rateLimitState.requestsThisSecond >= this.rateLimitPerSecond) {
      const waitTime = this.rateLimitState.secondResetTime - now;
      logger.warn(`Rate limit per second reached, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return this.checkRateLimit(); // Recheck after waiting
    }

    if (this.rateLimitState.requestsThisHour >= this.rateLimitPerHour) {
      throw new AcuityAPIError(
        "Hourly rate limit exceeded. Please try again later.",
        429,
        "RATE_LIMIT_EXCEEDED"
      );
    }

    // Increment counters
    this.rateLimitState.requestsThisSecond++;
    this.rateLimitState.requestsThisHour++;
  }

  // Generic API request method
  private async request<T>(method: string, endpoint: string, data?: unknown): Promise<T> {
    await this.checkRateLimit();

    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const options: RequestInit = {
        method,
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        signal: controller.signal,
      };

      if (data && (method === "POST" || method === "PUT" || method === "PATCH")) {
        options.body = JSON.stringify(data);
      }

      logger.debug({ method, url }, "Making Acuity API request");

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Acuity API error: ${response.status} ${response.statusText}`;

        // Parse error details if JSON
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Use text as-is if not JSON
          if (errorText) {
            errorMessage = errorText;
          }
        }

        // User-friendly messages for common errors
        if (response.status === 503 || response.status === 502) {
          throw new AcuityAPIError(
            "The scheduling service is temporarily unavailable. Please try again in a few moments.",
            response.status,
            "SERVICE_UNAVAILABLE"
          );
        }

        if (response.status === 401) {
          throw new AcuityAPIError(
            "Authentication with the scheduling service failed. Please contact support.",
            response.status,
            "UNAUTHORIZED"
          );
        }

        throw new AcuityAPIError(errorMessage, response.status);
      }

      const result = await response.json();
      return result as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AcuityAPIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new AcuityAPIError(
            "Request to scheduling service timed out. Please try again.",
            undefined,
            "TIMEOUT"
          );
        }

        if (error.message.includes("fetch")) {
          throw new AcuityAPIError(
            "Unable to connect to the scheduling service. Please check your internet connection and try again.",
            undefined,
            "NETWORK_ERROR"
          );
        }
      }

      throw new AcuityAPIError(
        "An unexpected error occurred with the scheduling service. Please try again.",
        undefined,
        "UNKNOWN_ERROR",
        error
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Calendar operations
  async getCalendars(): Promise<AcuityCalendarType[]> {
    const calendars = await this.request<unknown[]>("GET", "/calendars");
    const results: AcuityCalendarType[] = [];

    for (const cal of calendars) {
      const parsed = AcuityCalendar(cal);
      if (parsed instanceof type.errors) {
        logger.error(
          {
            errors: parsed.map((e) => ({ path: e.path, message: e.message })),
            data: cal,
          },
          "Invalid calendar data from Acuity"
        );
        throw new AcuityAPIError("Invalid calendar data received from Acuity");
      }
      results.push(parsed);
    }

    return results;
  }

  async getCalendarById(calendarId: string): Promise<AcuityCalendarType | null> {
    try {
      const calendars = await this.getCalendars();
      return calendars.find((cal) => cal.id.toString() === calendarId) || null;
    } catch (error) {
      logger.error({ error, calendarId }, "Error fetching calendar by ID");
      throw error;
    }
  }

  // Appointment type operations
  async getAppointmentTypes(): Promise<AcuityAppointmentTypeType[]> {
    const types = await this.request<unknown[]>("GET", "/appointment-types");
    const results: AcuityAppointmentTypeType[] = [];

    for (const appointmentType of types) {
      const parsed = AcuityAppointmentType(appointmentType);
      if (parsed instanceof type.errors) {
        logger.error(
          {
            errors: parsed.map((e) => ({ path: e.path, message: e.message })),
            data: appointmentType,
          },
          "Invalid appointment type data from Acuity"
        );
        throw new AcuityAPIError("Invalid appointment type data received from Acuity");
      }
      results.push(parsed);
    }

    // Cache the results
    await cacheAppointmentTypes(results);

    return results;
  }

  // Get available dates for a month
  async getAvailabilityDates(params: {
    month: string; // YYYY-MM format
    appointmentTypeId: number;
    calendarId?: number;
  }): Promise<string[]> {
    const queryParams = new URLSearchParams({
      month: params.month,
      appointmentTypeID: params.appointmentTypeId.toString(),
      ...(params.calendarId && { calendarID: params.calendarId.toString() }),
    });

    const response = await this.request<Array<{ date: string }>>(
      "GET",
      `/availability/dates?${queryParams.toString()}`
    );

    // Extract just the date strings from the response
    return response.map((item) => item.date);
  }

  // Get availability times for a specific date
  async getAvailabilityTimes(params: {
    appointmentTypeId: number;
    calendarId: number;
    date: string; // YYYY-MM-DD format
    timezone?: string;
  }): Promise<AcuityAvailabilityTimeType[]> {
    // Check cache first (using calendarId as specialist identifier)
    const cached = await getCachedAvailability(
      params.calendarId.toString(),
      params.date,
      params.appointmentTypeId
    );

    if (cached) {
      logger.debug(
        {
          calendarId: params.calendarId,
          date: params.date,
        },
        "Returning cached availability"
      );
      return cached as AcuityAvailabilityTimeType[];
    }

    const queryParams = new URLSearchParams({
      appointmentTypeID: params.appointmentTypeId.toString(),
      calendarID: params.calendarId.toString(),
      date: params.date,
      ...(params.timezone && { timezone: params.timezone }),
    });

    const times = await this.request<AcuityAvailabilityTimeType[]>(
      "GET",
      `/availability/times?${queryParams.toString()}`
    );

    // Cache the results
    await cacheAvailability(
      params.calendarId.toString(),
      params.date,
      params.appointmentTypeId,
      times
    );

    return times;
  }

  // Appointment operations
  async createAppointment(data: {
    datetime: string;
    appointmentTypeID: number;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    timezone?: string;
    fields?: Array<{ id: number; value: string }>;
    calendarID?: number; // Optional, for compatibility
    notes?: string; // Optional, can be included in fields if needed
  }): Promise<AcuityAppointmentType> {
    // Build the request payload matching Acuity's expected format
    const requestPayload: any = {
      appointmentTypeID: data.appointmentTypeID,
      datetime: data.datetime,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
    };

    // Add optional fields only if they're provided
    if (data.phone) requestPayload.phone = data.phone;
    if (data.timezone) requestPayload.timezone = data.timezone;
    if (data.fields && data.fields.length > 0) requestPayload.fields = data.fields;
    
    // If notes are provided, add them to the payload
    // Note: Acuity typically handles notes through form fields, but some endpoints accept it directly
    if (data.notes) requestPayload.notes = data.notes;
    
    // CalendarID is typically not needed in the request as Acuity determines it from appointmentTypeID
    // But include it if explicitly provided for backward compatibility
    if (data.calendarID) requestPayload.calendarID = data.calendarID;

    const appointment = await this.request<unknown>("POST", "/appointments", requestPayload);
    const parsed = AcuityAppointment(appointment);

    if (parsed instanceof type.errors) {
      logger.error(
        {
          errors: parsed.map((e) => ({ path: e.path, message: e.message })),
          data: appointment,
        },
        "Invalid appointment data from Acuity"
      );
      throw new AcuityAPIError("Invalid appointment data received from Acuity");
    }

    // Invalidate availability cache for this calendar
    if (parsed.calendarID) {
      await invalidateAvailabilityCache(parsed.calendarID.toString());
    }

    return parsed;
  }

  async updateAppointment(
    appointmentId: number,
    data: Partial<{
      datetime: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      notes: string;
    }>
  ): Promise<AcuityAppointmentType> {
    const appointment = await this.request<unknown>("PUT", `/appointments/${appointmentId}`, data);
    const parsed = AcuityAppointment(appointment);

    if (parsed instanceof type.errors) {
      logger.error(
        {
          errors: parsed.map((e) => ({ path: e.path, message: e.message })),
          data: appointment,
        },
        "Invalid appointment data from Acuity"
      );
      throw new AcuityAPIError("Invalid appointment data received from Acuity");
    }

    // Invalidate availability cache for this calendar
    await invalidateAvailabilityCache(parsed.calendarID.toString());

    return parsed;
  }

  async cancelAppointment(appointmentId: number): Promise<void> {
    // Get appointment details first to know which calendar to invalidate
    try {
      const appointment = await this.getAppointment(appointmentId);
      await this.request("DELETE", `/appointments/${appointmentId}`);

      // Invalidate availability cache for this calendar
      await invalidateAvailabilityCache(appointment.calendarID.toString());
    } catch {
      // If we can't get the appointment, still try to cancel it
      await this.request("DELETE", `/appointments/${appointmentId}`);
      // Invalidate all availability caches as fallback
      await invalidateAvailabilityCache();
    }
  }

  async getAppointment(appointmentId: number): Promise<AcuityAppointmentType> {
    const appointment = await this.request<unknown>("GET", `/appointments/${appointmentId}`);
    const parsed = AcuityAppointment(appointment);

    if (parsed instanceof type.errors) {
      logger.error(
        {
          errors: parsed.map((e) => ({ path: e.path, message: e.message })),
          data: appointment,
        },
        "Invalid appointment data from Acuity"
      );
      throw new AcuityAPIError("Invalid appointment data received from Acuity");
    }

    return parsed;
  }

  // Form operations
  async getForms(): Promise<AcuityFormType[]> {
    const forms = await this.request<unknown[]>("GET", "/forms");
    const results: AcuityFormType[] = [];

    for (const form of forms) {
      const parsed = AcuityForm(form);
      if (parsed instanceof type.errors) {
        logger.error(
          {
            errors: parsed.map((e) => ({ path: e.path, message: e.message })),
            data: form,
          },
          "Invalid form data from Acuity"
        );
        throw new AcuityAPIError("Invalid form data received from Acuity");
      }
      
      // Validate fields separately
      if (parsed.fields && Array.isArray(parsed.fields)) {
        const validatedFields: AcuityFormFieldType[] = [];
        for (const field of parsed.fields) {
          const fieldParsed = AcuityFormField(field);
          if (fieldParsed instanceof type.errors) {
            logger.warn(
              {
                errors: fieldParsed.map((e) => ({ path: e.path, message: e.message })),
                data: field,
                formId: parsed.id,
              },
              "Invalid form field data from Acuity"
            );
            // Skip invalid fields but continue processing
            continue;
          }
          validatedFields.push(fieldParsed);
        }
        parsed.fields = validatedFields;
      }
      
      results.push(parsed);
    }

    logger.debug({ count: results.length }, "Fetched forms from Acuity");
    
    return results;
  }

  // Webhook signature validation with timing attack prevention
  validateWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", env.ACUITY_WEBHOOK_SECRET)
      .update(payload)
      .digest("base64");

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  }
}

// Singleton instance
export const acuityService = new AcuityService();
