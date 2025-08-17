import type { Context, Next } from "hono";
import { redis } from "@/lib/redis";

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
  keyPrefix?: string; // Prefix for Redis keys
  skip?: (c: Context) => boolean; // Function to skip rate limiting
}

export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, keyPrefix = "ratelimit", skip } = options;

  return async function rateLimitMiddleware(c: Context, next: Next) {
    // Skip rate limiting if configured
    if (skip && skip(c)) {
      return next();
    }

    const authContext = c.get("auth");
    const userId = authContext?.user?.id;
    
    if (!userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Create a unique key for this user and endpoint
    const key = `${keyPrefix}:${userId}:${c.req.path}`;
    
    try {
      // Get current count
      const currentCount = await redis.get(key);
      const count = currentCount ? parseInt(currentCount, 10) : 0;

      if (count >= max) {
        const ttl = await redis.ttl(key);
        return c.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Please try again in ${Math.ceil(ttl / 60)} minutes.`,
            retryAfter: ttl,
          },
          429
        );
      }

      // Increment counter
      if (count === 0) {
        // First request in window
        await redis.set(key, "1", { PX: windowMs });
      } else {
        // Increment existing counter
        await redis.incr(key);
      }

      // Add rate limit headers
      c.header("X-RateLimit-Limit", max.toString());
      c.header("X-RateLimit-Remaining", (max - count - 1).toString());
      c.header("X-RateLimit-Reset", new Date(Date.now() + windowMs).toISOString());

      return next();
    } catch (error) {
      console.error("Rate limit middleware error:", error);
      // Continue without rate limiting on error
      return next();
    }
  };
}

// Pre-configured rate limiters
export const bookingCreateRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 bookings per 15 minutes
  keyPrefix: "booking-create",
});

export const apiGeneralRateLimit = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  keyPrefix: "api-general",
});

export const documentUploadRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 document uploads per hour
  keyPrefix: "document-upload",
});