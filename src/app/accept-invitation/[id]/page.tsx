import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { invitations, organizations, users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept Invitation - Medibytes",
  description: "Accept your invitation to join Medibytes Booking Portal",
};

interface AcceptInvitationPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AcceptInvitationPage({ params }: AcceptInvitationPageProps) {
  const { id: invitationId } = await params;

  // Fetch invitation details
  const invitation = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      organizationId: invitations.organizationId,
      organizationName: organizations.name,
      role: invitations.role,
      teamId: invitations.teamId,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .leftJoin(organizations, eq(invitations.organizationId, organizations.id))
    .where(eq(invitations.id, invitationId))
    .limit(1);

  if (invitation.length === 0) {
    notFound();
  }

  const invite = invitation[0];

  // Check if invitation is expired
  if (new Date() > invite.expiresAt) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Invitation Expired</h2>
              <p className="mt-2 text-sm text-gray-600">
                This invitation has expired. Please contact your administrator for a new invitation.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check if invitation was already accepted
  if (invite.status !== "pending") {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Invitation Already Used</h2>
              <p className="mt-2 text-sm text-gray-600">
                This invitation has already been {invite.status}. 
                {invite.status === "accepted" && " Please sign in to continue."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }


  // Check if user already exists (for pre-filling form data)
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, invite.email),
  });

  // Prepare user data for form - use existing data or empty defaults
  const userData = existingUser
    ? {
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        jobTitle: existingUser.jobTitle || "",
      }
    : {
        firstName: "",
        lastName: "",
        jobTitle: "",
      };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Welcome to Medibytes</h1>
          <p className="mt-2 text-sm text-gray-600">
            You&apos;ve been invited to join {invite.organizationName}
          </p>
        </div>

        <div className="mt-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <AcceptInvitationForm invitation={invite} user={userData} />
        </div>
      </div>
    </div>
  );
}