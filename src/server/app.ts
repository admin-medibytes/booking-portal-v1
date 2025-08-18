import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthCheck } from "./db";
import { env } from "@/lib/env";
import { logger as appLogger } from "./utils/logger";
import { AppError } from "./utils/errors";
import authRoutes from "./routes/auth.routes";
import adminRoutes from "./routes/admin.routes";
import publicRoutes from "./routes/public.routes";
import userRoutes from "./routes/user.routes";
import { bookingsRoutes } from "./routes/bookings.routes";
import { specialistsRoutes } from "./routes/specialists.routes";
import { documentsRoutes } from "./routes/documents.routes";
import { ContentfulStatusCode } from "hono/utils/http-status";

const app = new Hono()
  .basePath("/api")

  .use("*", logger())
  .use("*", cors())

  // Mount public routes (no auth required)
  .route("/public", publicRoutes)

  // Mount auth routes
  .route("/auth", authRoutes)

  // Mount admin routes
  .route("/admin", adminRoutes)

  // Mount user routes (authenticated)
  .route("/user", userRoutes)

  // Mount bookings routes (authenticated)
  .route("/bookings", bookingsRoutes)

  // Mount specialists routes (authenticated)
  .route("/specialists", specialistsRoutes)

  // Mount documents routes (authenticated)
  .route("/documents", documentsRoutes)

  .get("/health", async (c) => {
    const dbHealth = await healthCheck();
    const overallStatus = dbHealth.status === "healthy" ? "ok" : "degraded";

    appLogger.info("Health check performed", {
      status: overallStatus,
      database: dbHealth.status,
    });

    return c.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "0.1.0",
      environment: env.NODE_ENV || "development",
      checks: {
        app: "running",
        database: {
          status: dbHealth.status,
          message: dbHealth.message,
          ...dbHealth.details,
        },
        redis: "pending",
      },
    });
  })

  // Global error handler
  .onError((err, c) => {
    if (err instanceof AppError) {
      // Log based on error severity
      if (err.statusCode >= 500) {
        appLogger.error(err.message, err, {
          code: err.code,
          details: err.details,
          url: c.req.url,
          method: c.req.method,
        });
      } else {
        appLogger.info(err.message, {
          code: err.code,
          details: err.details,
          url: c.req.url,
          method: c.req.method,
          status: err.statusCode,
        });
      }

      return c.json(err.toJSON(), err.statusCode as ContentfulStatusCode);
    }

    // Log unexpected errors
    appLogger.error("Unexpected error", err as Error, {
      url: c.req.url,
      method: c.req.method,
    });

    return c.json(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: env.NODE_ENV === "production" ? "Internal server error" : err.message,
        timestamp: new Date().toISOString(),
      },
      500
    );
  });

export default app;

// Export type for RPC client
export type AppType = typeof app;
