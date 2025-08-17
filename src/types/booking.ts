import { InferSelectModel } from 'drizzle-orm';
import { bookings, bookingProgress, specialists } from '@/server/db/schema';

export type Booking = InferSelectModel<typeof bookings>;
export type BookingProgress = InferSelectModel<typeof bookingProgress>;
export type Specialist = InferSelectModel<typeof specialists>;

export interface BookingWithSpecialist extends Booking {
  specialist: {
    id: string;
    name: string;
    specialty: Specialist['specialty'];
    location?: string | null;
  } | null;
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
  organizationId?: string;
  referrerId?: string;
  page?: number;
  limit?: number;
}