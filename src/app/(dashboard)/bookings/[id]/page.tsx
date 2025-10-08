import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { BookingDetailClient } from "./booking-detail-client";
import { bookingService } from "@/server/services/booking.service";

interface BookingDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function BookingDetailPage({ params }: BookingDetailPageProps) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    notFound();
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return notFound();
  }

  const booking = await bookingService.getBookingById(id, {
    id: session.user.id,
    role: session.user.role as "user" | "admin" | null,
  });

  // Check permissions
  const userOrgRole = session.session?.activeOrganizationId
    ? await bookingService.getUserOrganizationRole(
        session.user.id,
        session.session.activeOrganizationId
      )
    : undefined;

  const isSpecialistForBooking =
    userOrgRole === "specialist" &&
    booking.specialist?.id &&
    (await bookingService.isUserSpecialist(session.user.id, booking.specialist.id));

  const canUpdateProgress = session.user.role === "admin" || isSpecialistForBooking || false;

  return (
    <BookingDetailClient
      booking={{
        organization: booking.organization,
        acuityAppointmentId: booking.acuityAppointmentId,
        acuityAppointmentTypeId: booking.acuityAppointmentTypeId,
        acuityCalendarId: booking.acuityCalendarId,
        cancelledAt: booking.cancelledAt,
        completedAt: booking.completedAt,
        createdAt: booking.createdAt,
        createdById: booking.createdById,
        dateTime: booking.dateTime,
        duration: booking.duration,
        currentProgress: booking.currentProgress,
        documents: booking.documents,
        id: booking.id,
        location: booking.location,
        organizationId: booking.organizationId,
        specialist: {
          id: booking.specialist.id,
          name: booking.specialist.name,
          image: booking.specialist.image || "",
          user: booking.specialist.user,
          location: booking.specialist.location,
        },
        status: booking.status,
        examinee: booking.examinee,
        referrer: booking.referrer,
        progress: booking.progress,
        teamId: booking.teamId,
        type: booking.type,
        referrerOrganization: booking.referrer.organization,
        examineeId: booking.examineeId,
        referrerId: booking.referrerId,
        specialistId: booking.specialistId,
        updatedAt: booking.updatedAt,
        scheduledAt: booking.scheduledAt,
      }}
      session={{
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          role: session.user.role || "user",
        },
        session: session.session,
      }}
      canUpdateProgress={canUpdateProgress}
    />
  );
}
