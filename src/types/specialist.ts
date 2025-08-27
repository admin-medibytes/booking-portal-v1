export interface SpecialistLocation {
  streetAddress?: string;
  suburb?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
}

export interface Specialist {
  id: string;
  userId: string;
  acuityCalendarId: string;
  name: string;
  slug: string;
  image?: string | null;
  position: number;
  email?: string;
  phone?: string;
  location?: SpecialistLocation | null;
  acceptsInPerson: boolean;
  acceptsTelehealth: boolean;
  isActive: boolean;
  organizationId?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string;
  };
  createdAt: Date;
  updatedAt: Date;
}