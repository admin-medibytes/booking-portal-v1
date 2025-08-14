import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { auth } from "@/lib/auth";
import type { Session } from "@/lib/auth";

// Extend the Hono Context with auth types
declare module "hono" {
  interface ContextVariableMap {
    auth: {
      user: Session["user"] | null;
      session: Session["session"] | null;
    };
  }
}

/**
 * Middleware to check if user is authenticated
 * Adds user and session to the context
 */
export const authMiddleware = createMiddleware(async (c, next) => {
  try {
    const sessionData = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!sessionData) {
      c.set("auth", { user: null, session: null });
      await next();
      return;
    }

    c.set("auth", {
      user: sessionData.user,
      session: sessionData.session,
    });

    await next();
  } catch {
    c.set("auth", { user: null, session: null });
    await next();
  }
});

/**
 * Middleware to require authentication
 * Throws 401 if user is not authenticated
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const authContext = c.get("auth");
  
  if (!authContext?.user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  await next();
});

/**
 * Middleware to require specific role
 * @param role The role required
 */
export const requireRole = (role: string) =>
  createMiddleware(async (c, next) => {
    const authContext = c.get("auth");

    if (!authContext?.user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    const userRoles = authContext.user.role?.split(",").map((r) => r.trim()) || [];
    
    if (!userRoles.includes(role)) {
      throw new HTTPException(403, { message: "Forbidden: Insufficient permissions" });
    }

    await next();
  });

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole("admin");

/**
 * Middleware to check organization permissions
 * @param permissions Object with resource and actions required
 */
export const requireOrgPermission = (permissions: Record<string, string[]>) =>
  createMiddleware(async (c, next) => {
    const authContext = c.get("auth");

    if (!authContext?.user) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }

    // Check if user has required permissions in their active organization
    const hasPermission = await auth.api.hasPermission({
      headers: c.req.raw.headers,
      body: {
        permissions,
      },
    });

    if (!hasPermission) {
      throw new HTTPException(403, { 
        message: "Forbidden: Insufficient organization permissions" 
      });
    }

    await next();
  });

/**
 * Middleware to check if user is banned
 */
export const checkBanned = createMiddleware(async (c, next) => {
  const authContext = c.get("auth");

  if (authContext?.user?.banned) {
    const banReason = authContext.user.banReason || "You have been banned from this application";
    throw new HTTPException(403, { message: banReason });
  }

  await next();
});

/**
 * Middleware to check if session is impersonated
 * Adds impersonation info to response headers
 */
export const checkImpersonation = createMiddleware(async (c, next) => {
  const authContext = c.get("auth");

  if (authContext?.session?.impersonatedBy) {
    c.header("X-Impersonated-By", authContext.session.impersonatedBy);
  }

  await next();
});