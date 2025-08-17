export interface Specialist {
  id: string;
  name: string;
  specialty: string;
  email?: string;
  phone?: string;
  location?: string;
  active: boolean;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}