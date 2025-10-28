import { Hono } from "hono";
import { handle } from "hono/vercel";
import { logger } from "hono/logger";
import { webhooksRoutes } from "@/server/routes/webhooks.routes";

const app = new Hono().basePath("/webhooks");

// Webhooks don't need CORS but we'll add logging
app.use("*", logger());

// Mount webhook routes
app.route("/", webhooksRoutes);

export const runtime = "nodejs";

export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const PATCH = handle(app)
export const OPTIONS = handle(app)