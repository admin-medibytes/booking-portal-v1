import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Management | Admin | Medibytes Booking Portal",
  description: "Create and manage users across organizations",
};

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
