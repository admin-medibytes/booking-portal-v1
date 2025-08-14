import { createAuthClient } from "better-auth/client";
import type { auth } from "./auth.js";
import { inferAdditionalFields, organizationClient, twoFactorClient, phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  plugins: [
    inferAdditionalFields<typeof auth>(),
    organizationClient(),
    twoFactorClient(),
    phoneNumberClient(),
  ],
});
