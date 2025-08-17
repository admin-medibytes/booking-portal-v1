// Re-export Acuity types from the service for shared usage
export type {
  AcuityCalendarType,
  AcuityTimeSlotType,
  AcuityAppointmentTypeType,
  AcuityAppointmentType,
} from "@/server/services/acuity.service";

// Webhook event types
export interface AcuityWebhookEvent {
  id: string;
  action: "scheduled" | "rescheduled" | "canceled" | "changed";
  appointmentId: number;
  calendarId: number;
  datetime: string;
}

// Request/Response types for our API endpoints
export interface SpecialistAvailabilityRequest {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  appointmentTypeId?: number;
  timezone?: string;
}

export interface SpecialistAvailabilityResponse {
  specialistId: string;
  calendarId: string;
  timeSlots: Array<{
    date: string;
    time: string;
    datetime: string;
    duration: number;
    appointmentTypeId: number;
    available: boolean;
  }>;
}

export interface SyncSpecialistRequest {
  userId: string;
  acuityCalendarId: string;
}