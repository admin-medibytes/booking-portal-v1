import { hc } from "hono/client";
import type { AppType } from "@/server/app";
import { env } from "./env";

// Create the typed client
// Use a conditional to handle server vs client environment
const baseUrl =
  typeof window !== "undefined"
    ? "" // Use relative URL on client
    : env.NEXT_PUBLIC_APP_URL;

// Create typed client - the type will be inferred from server
export const client = hc<AppType>(`${baseUrl}`, {
  fetch: ((input, init) =>
    fetch(input, { ...init, credentials: "include" })) satisfies typeof fetch,
});

// Export individual route clients for easier access
export const adminClient = client.api.admin;
export const userClient = client.api.user;
export const bookingsClient = client.api.bookings;
export const specialistsClient = client.api.specialists;
// export const documentsClient = client.api.documents;
export const publicClient = client.api.public;
