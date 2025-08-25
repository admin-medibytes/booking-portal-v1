import { Hono } from "hono";
import { authMiddleware, requireAuth, requireRole } from "@/server/middleware/auth.middleware";
import { specialistRepository } from "@/server/repositories/specialist.repository";
import { logger } from "@/server/utils/logger";

const adminSpecialistsRoutes = new Hono()
  // Apply auth middleware to all routes
  .use("*", authMiddleware)
  .use("*", requireAuth)
  .use("*", requireRole("admin"))

  // GET /api/admin/specialists - List all specialists sorted by position with full user details
  .get("/", async (c) => {
    try {
      const authContext = c.get("auth");
      const adminUser = authContext?.user;
      if (!adminUser) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const includeInactive = c.req.query("includeInactive") === "true";

      // Audit log the access
      logger.audit("admin_view_specialist_list", adminUser.id, "specialist", "list", {
        includeInactive,
      });

      const specialists = includeInactive
        ? await specialistRepository.findAll()
        : await specialistRepository.findAllActive();

      // Return with full user details for admin
      return c.json({
        success: true,
        data: specialists.map(({ specialist, user }) => ({
          id: specialist.id,
          userId: specialist.userId,
          acuityCalendarId: specialist.acuityCalendarId,
          name: specialist.name,
          location: specialist.location,
          position: specialist.position,
          isActive: specialist.isActive,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            jobTitle: user.jobTitle,
          },
          createdAt: specialist.createdAt,
          updatedAt: specialist.updatedAt,
        })),
      });
    } catch (error) {
      logger.error("Failed to list specialists for admin", error as Error);
      return c.json(
        {
          success: false,
          error: "Failed to retrieve specialists",
        },
        500
      );
    }
  });

export { adminSpecialistsRoutes };