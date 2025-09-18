import { createAuthClient } from "better-auth/client";
import type { auth } from "./auth.js";

import { env } from "@/lib/env";

import {
  inferAdditionalFields,
  adminClient,
  organizationClient,
  twoFactorClient,
  phoneNumberClient,
} from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    adminClient(),
    organizationClient(),
    twoFactorClient(),
    phoneNumberClient(),
  ],
});
