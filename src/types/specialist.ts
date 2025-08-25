export interface Specialist {
  id: string;
  name: string;
  position: number;
  email?: string;
  phone?: string;
  location?: string;
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