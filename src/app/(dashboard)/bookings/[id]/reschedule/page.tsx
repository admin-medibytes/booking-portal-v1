import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { bookingService } from "@/server/services/booking.service";
import { RescheduleClient } from "./reschedule-client";

interface ReschedulePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ReschedulePage({ params }: ReschedulePageProps) {
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

  if (!booking) {
    notFound();
  }

  if (!booking.dateTime) {
    notFound();
  }

  return <RescheduleClient booking={{
    id: booking.id,
    acuityAppointmentId: booking.acuityAppointmentId,
    acuityAppointmentTypeId: booking.acuityAppointmentTypeId,
    dateTime: booking.dateTime,
    duration: booking.duration,
    type: booking.type,
    status: booking.status,
    specialist: booking.specialist,
  }} />;
}
