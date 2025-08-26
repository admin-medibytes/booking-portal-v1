export interface AppUserProps {
  user: {
    name: string;
    email: string;
    role: "admin" | "specialist" | "referrer";
    image: string | null;
  };
}
