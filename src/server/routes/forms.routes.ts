import { Hono } from "hono";
import { authMiddleware } from "@/server/middleware/auth.middleware";
import { appFormsService } from "@/server/services/appForms.service";
import { logger } from "@/server/utils/logger";

const app = new Hono()
  .use("*", authMiddleware)
  // Get app form for rendering (authenticated users only)
  .get("/app-forms/:id/render", async (c) => {
    const id = c.req.param("id");

    try {
      const form = await appFormsService.getPublicAppForm(id);
      return c.json(form);
    } catch (error) {
      logger.error("Failed to get app form for rendering", error as Error, { id });
      
      if ((error as any).name === "NotFoundError") {
        return c.json({ error: "Form not found or not active" }, 404);
      }
      
      return c.json({ error: "Failed to get form" }, 500);
    }
  });

export default app;