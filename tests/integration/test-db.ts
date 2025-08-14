import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as authSchema from '@/server/db/schema/auth';
import * as specialistsSchema from '@/server/db/schema/specialists';
import * as bookingsSchema from '@/server/db/schema/bookings';
import * as documentsSchema from '@/server/db/schema/documents';
import * as auditSchema from '@/server/db/schema/audit';
import * as webhooksSchema from '@/server/db/schema/webhooks';

// Create a test database connection that doesn't interfere with the main app
let connectionString = env.DATABASE_URL;
if (env.DB_SSL === 'false' && !connectionString.includes('?')) {
  connectionString += '?sslmode=disable';
}

const globalForTestDb = globalThis as unknown as {
  testClient: postgres.Sql | undefined;
};

export const testClient =
  globalForTestDb.testClient ??
  postgres(connectionString, {
    max: 5, // Smaller pool for tests
    idle_timeout: 30,
    connect_timeout: 10,
    max_lifetime: 60 * 30,
    prepare: false,
    ssl: env.DB_SSL === "true" ? "require" : false,
    onnotice: () => {},
  });

if (env.NODE_ENV === "test") globalForTestDb.testClient = testClient;

export const schema = {
  ...authSchema,
  ...specialistsSchema,
  ...bookingsSchema,
  ...documentsSchema,
  ...auditSchema,
  ...webhooksSchema,
};

export const testDb = drizzle(testClient, { schema });

export type TestDatabase = typeof testDb;

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await testClient`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  try {
    await testClient.end();
  } catch (error) {
    throw error;
  }
}

export interface DatabaseHealthCheck {
  status: 'healthy' | 'unhealthy';
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
    const startTime = performance.now();
    await testClient`SELECT NOW()`;
    const responseTime = Math.round(performance.now() - startTime);
    
    return {
      status: 'healthy',
      message: 'Database connection is healthy',
      details: {
        poolSize: 5,
        idleConnections: 0,
        waitingQueue: 0,
        responseTime: responseTime || 1, // Ensure it's at least 1ms
      },
    };
  } catch (error) {
    const dbError = error as Error;
    
    return {
      status: 'unhealthy',
      message: `Database connection failed: ${dbError.message}`,
    };
  }
}