import { createClient } from "redis";
import { env } from "@/lib/env";
import pino from "pino";

const logger = pino({ name: "redis" });

// Type for Redis client
export type RedisClientType = ReturnType<typeof createClient>;

// Create Redis client
export const redis = createClient({
  url: env.REDIS_URL,
  database: Number(env.REDIS_DB),
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 3) {
        logger.error("Redis connection failed after 3 retries");
        return new Error("Redis connection failed");
      }
      const delay = Math.min(retries * 50, 500);
      logger.info(`Retrying Redis connection in ${delay}ms...`);
      return delay;
    },
  },
});

// Connection event handlers
redis.on("error", (err) => {
  logger.error({ error: err }, "Redis client error");
});

redis.on("connect", () => {
  logger.info("Redis client connected");
});

redis.on("ready", () => {
  logger.info("Redis client ready");
});

// Connect on module load
redis.connect().catch((err) => {
  logger.error({ error: err }, "Failed to connect to Redis");
});

// Cache key prefixes
export const CACHE_KEYS = {
  AVAILABILITY: "acuity:availability:",
  APPOINTMENT_TYPES: "acuity:appointment_types:",
  CALENDAR: "acuity:calendar:",
  SPECIALIST: "specialist:",
} as const;

// Cache TTL values (in seconds)
export const CACHE_TTL = {
  SHORT: Number(env.CACHE_TTL_SHORT) || 300, // 5 minutes default
  LONG: Number(env.CACHE_TTL_LONG) || 3600, // 1 hour default
} as const;

// Helper functions for caching
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error({ error, key }, "Error getting cached data");
    return null;
  }
}

export async function setCachedData<T>(
  key: string,
  data: T,
  ttlSeconds: number
): Promise<void> {
  try {
    await redis.setEx(key, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    logger.error({ error, key }, "Error setting cached data");
    // Don't throw - caching failures shouldn't break the app
  }
}

export async function deleteCachedData(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch (error) {
    logger.error({ error, pattern }, "Error deleting cached data");
  }
}

// Specific cache functions for Acuity data
export async function cacheAvailability(
  specialistId: string,
  date: string,
  appointmentTypeId: number,
  data: unknown
): Promise<void> {
  const key = `${CACHE_KEYS.AVAILABILITY}${specialistId}:${date}:${appointmentTypeId}`;
  await setCachedData(key, data, CACHE_TTL.SHORT);
}

export async function getCachedAvailability(
  specialistId: string,
  date: string,
  appointmentTypeId: number
): Promise<unknown | null> {
  const key = `${CACHE_KEYS.AVAILABILITY}${specialistId}:${date}:${appointmentTypeId}`;
  return getCachedData(key);
}

export async function cacheAppointmentTypes(data: unknown): Promise<void> {
  const key = `${CACHE_KEYS.APPOINTMENT_TYPES}all`;
  await setCachedData(key, data, CACHE_TTL.LONG);
}

export async function getCachedAppointmentTypes(): Promise<unknown | null> {
  const key = `${CACHE_KEYS.APPOINTMENT_TYPES}all`;
  return getCachedData(key);
}

export async function invalidateAvailabilityCache(specialistId?: string): Promise<void> {
  const pattern = specialistId 
    ? `${CACHE_KEYS.AVAILABILITY}${specialistId}:*`
    : `${CACHE_KEYS.AVAILABILITY}*`;
  await deleteCachedData(pattern);
}

export async function invalidateAppointmentTypesCache(): Promise<void> {
  await deleteCachedData(`${CACHE_KEYS.APPOINTMENT_TYPES}*`);
}