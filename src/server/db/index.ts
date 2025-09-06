import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import { logger } from "@/server/utils/logger";
import { DatabaseError, ErrorCode } from "@/server/utils/errors";
import * as authSchema from "./schema/auth";
import * as specialistsSchema from "./schema/specialists";
import * as bookingsSchema from "./schema/bookings";
import * as documentsSchema from "./schema/documents";
import * as auditSchema from "./schema/audit";
import * as webhooksSchema from "./schema/webhooks";

const poolSize = parseInt(env.DB_POOL_SIZE || "10", 10);

let connectionString = env.DATABASE_URL;
if (env.DB_SSL === "false" && !connectionString.includes("?")) {
  connectionString += "?sslmode=disable";
}

const globalForDb = globalThis as unknown as {
  client: postgres.Sql | undefined;
};

const client =
  globalForDb.client ??
  postgres(connectionString, {
    max: poolSize,
    idle_timeout: 30,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: false,
    ssl: env.DB_SSL === "true" ? "require" : false,
    onnotice: () => {},
  });

if (env.NODE_ENV !== "production") globalForDb.client = client;

export const schema = {
  ...authSchema,
  ...specialistsSchema,
  ...bookingsSchema,
  ...documentsSchema,
  ...auditSchema,
  ...webhooksSchema,
};

export const db = drizzle(client, { schema });

export type Database = typeof db;

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const startTime = Date.now();
    await client`SELECT 1`;
    const duration = Date.now() - startTime;
    logger.dbConnection("connected", { duration });
    return true;
  } catch (error) {
    logger.dbError("connection test", error as Error);
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    await client.end();
    logger.dbConnection("disconnected");
  } catch (error) {
    logger.dbError("close connection", error as Error);
    throw error;
  }
}

export interface DatabaseHealthCheck {
  status: "healthy" | "unhealthy";
  message: string;
  details?: {
    poolSize: number;
    idleConnections: number;
    waitingQueue: number;
    responseTime?: number;
  };
}

export async function healthCheck(): Promise<DatabaseHealthCheck> {
  try {
    const startTime = Date.now();
    await client`SELECT NOW()`;
    const responseTime = Date.now() - startTime;

    return {
      status: "healthy",
      message: "Database connection is healthy",
      details: {
        poolSize: poolSize,
        idleConnections: 0, // postgres.js doesn't expose these metrics
        waitingQueue: 0,
        responseTime,
      },
    };
  } catch (error) {
    const dbError = error as Error;
    logger.dbError("health check", dbError);

    return {
      status: "unhealthy",
      message: `Database connection failed: ${dbError.message}`,
    };
  }
}

const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY = 1000; // Start with 1 second
const MAX_RETRY_DELAY = 30000; // Cap at 30 seconds

// Calculate exponential backoff delay
function getRetryDelay(attemptNumber: number): number {
  const delay = Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attemptNumber), MAX_RETRY_DELAY);
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.3 * delay;
  return Math.floor(delay + jitter);
}

export async function initializeDatabaseConnection(): Promise<void> {
  let retryCount = 0;
  let lastError: Error | undefined;

  while (retryCount < MAX_RETRIES) {
    try {
      const connected = await testDatabaseConnection();
      if (connected) {
        logger.info("Database connection established successfully", {
          retryCount,
          poolSize,
        });
        return;
      }
      throw new Error("Database connection test failed");
    } catch (error) {
      lastError = error as Error;
      retryCount++;

      logger.warn(`Database connection attempt ${retryCount} failed`, {
        retryCount,
        maxRetries: MAX_RETRIES,
        error: lastError.message,
      });

      if (retryCount < MAX_RETRIES) {
        const retryDelay = getRetryDelay(retryCount - 1);
        logger.info(`Retrying database connection in ${retryDelay / 1000} seconds...`, {
          attemptNumber: retryCount,
          delay: retryDelay,
        });
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new DatabaseError(
    ErrorCode.DB_CONNECTION_FAILED,
    `Failed to establish database connection after ${MAX_RETRIES} attempts`,
    { lastError: lastError?.message },
    lastError
  );
}
