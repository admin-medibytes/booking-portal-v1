// Node.js compatible database configuration for scripts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/server/db/schema";
import { scriptEnv } from "./env";

const client = postgres(scriptEnv.DATABASE_URL, {
  max: 1, // Single connection for scripts
});

export const db = drizzle(client, { schema });

export { schema };