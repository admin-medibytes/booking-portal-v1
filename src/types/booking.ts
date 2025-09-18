import { InferSelectModel } from "drizzle-orm";
import { bookings, bookingProgress, specialists, referrers, examinees, organizations, type SpecialistLocation } from "@/server/db/schema";

export type Booking = InferSelectModel<typeof bookings>;
export type BookingProgress = InferSelectModel<typeof bookingProgress>;
export type Specialist = InferSelectModel<typeof specialists>;
export type Referrer = InferSelectModel<typeof referrers>;
export type Examinee = InferSelectModel<typeof examinees>;
export type Organization = InferSelectModel<typeof organizations>;

export interface BookingWithSpecialist extends Booking {
  specialist: {
    id: string;
    name: string;
    jobTitle: string;
    location?: SpecialistLocation | null;
  };
  referrer?: Referrer | null;
  examinee?: Examinee | null;
  referrerOrganization?: Organization | null;
}

export interface BookingWithProgress extends BookingWithSpecialist {
  progress: BookingProgress[];
  currentProgress?: string;
}

export interface BookingListResponse {
  bookings: BookingWithSpecialist[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface BookingFilters {
  status?: string;
  startDate?: Date;
  endDate?: Date;
  specialistId?: string;
  specialistIds?: string[];
  organizationId?: string;
  referrerId?: string;
  search?: string;
  page?: number;
  limit?: number;
}
