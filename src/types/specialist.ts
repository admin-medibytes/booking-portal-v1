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
  name: string;
  position: number;
  email?: string;
  phone?: string;
  location?: SpecialistLocation | null;
  acceptsInPerson: boolean;
  acceptsTelehealth: boolean;
  active: boolean;
  organizationId: string;
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