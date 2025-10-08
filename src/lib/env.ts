import { createEnv } from "@t3-oss/env-nextjs";
import { type } from "arktype";

export const env = createEnv({
  server: {
    NODE_ENV: type("'development' | 'production' | 'test'"),
    PORT: type("string.numeric"),
    // HOST: type("string"),
    APP_NAME: type("string"),
    APP_URL: type("string.url"),

    // Database
    DATABASE_URL: type("string.url"),
    DB_SSL: type("'true' | 'false'"),
    DB_POOL_SIZE: type("string.integer"),

    // Redis
    REDIS_URL: type("string.url"),
    REDIS_DB: type("string.integer"),

    // Authentication
    BETTER_AUTH_SECRET: type("string"),
    BETTER_AUTH_URL: type("string.url"),
    AUTH_TRUSTED_ORIGINS: type("string"),
    SESSION_SECRET: type("string"),

    // AWS
    AWS_REGION: type("string"),
    AWS_ACCESS_KEY_ID: type("string"),
    AWS_SECRET_ACCESS_KEY: type("string"),
    AWS_S3_BUCKET_NAME: type("string"),
    AWS_S3_REGION: type("string"),
    S3_UPLOAD_MAX_SIZE: type("string"),
    S3_PRESIGNED_URL_EXPIRY: type("string"),

    // S3 Storage
    STORAGE_REGION: type("string"),
    STORAGE_ENDPOINT: type("string"),
    STORAGE_ACCESS_KEY: type("string"),
    STORAGE_SECRET_KEY: type("string"),
    STORAGE_BUCKET: type("string"),

    // AWS SES
    AWS_SES_REGION: type("string"),
    SES_FROM_EMAIL: type("string.email"),
    SES_FROM_NAME: type("string"),

    // AWS CloudWatch
    CLOUDWATCH_LOG_GROUP: type("string"),
    CLOUDWATCH_LOG_STREAM: type("string"),

    // Acuity
    ACUITY_USER_ID: type("string"),
    ACUITY_API_KEY: type("string"),
    ACUITY_BASE_URL: type("string.url"),
    ACUITY_WEBHOOK_SECRET: type("string"),
    ACUITY_RATE_LIMIT_PER_SECOND: type("string.numeric"),
    ACUITY_RATE_LIMIT_PER_HOUR: type("string.numeric"),

    // Security
    ENCRYPTION_KEY: type("string"),
    CORS_ORIGIN: type("string"),
    ALLOWED_ORIGINS: type("string"),
    RATE_LIMIT_WINDOW_MS: type("string.numeric"),
    RATE_LIMIT_MAX_REQUESTS: type("string.numeric"),

    // Caching
    CACHE_TTL_SHORT: type("string.numeric"),
    CACHE_TTL_LONG: type("string.numeric"),

    // Logging
    LOG_LEVEL: type("'debug' | 'info' | 'warn' | 'error'"),
    STRUCTURED_LOGGING: type("'true' | 'false'"),
    AUDIT_LOG_ENABLED: type("'true' | 'false'"),
    MONITORING_ENABLED: type("'true' | 'false'"),
    ERROR_REPORTING_DSN: type("string|undefined"),

    // Feature Flags
    FEATURE_ADMIN_IMPERSONATION: type("'true' | 'false'"),
    FEATURE_PHONE_VERIFICATION: type("'true' | 'false'"),
    FEATURE_SMS_NOTIFICATIONS: type("'true' | 'false'"),
    FEATURE_DOCUMENT_VIRUS_SCAN: type("'true' | 'false'"),

    // File Upload
    MAX_FILE_SIZE: type("string.integer"),
  },
  client: {
    NEXT_PUBLIC_API_URL: type("string.url"),
    NEXT_PUBLIC_APP_URL: type("string.url"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    // HOST: process.env.HOST,
    APP_NAME: process.env.APP_NAME,
    APP_URL: process.env.APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    DB_SSL: process.env.DB_SSL,
    DB_POOL_SIZE: process.env.DB_POOL_SIZE,
    REDIS_URL: process.env.REDIS_URL,
    REDIS_DB: process.env.REDIS_DB,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    AUTH_TRUSTED_ORIGINS: process.env.AUTH_TRUSTED_ORIGINS,
    SESSION_SECRET: process.env.SESSION_SECRET,
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME,
    AWS_S3_REGION: process.env.AWS_S3_REGION,
    STORAGE_REGION: process.env.STORAGE_REGION,
    STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
    STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
    STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET,
    S3_UPLOAD_MAX_SIZE: process.env.S3_UPLOAD_MAX_SIZE,
    S3_PRESIGNED_URL_EXPIRY: process.env.S3_PRESIGNED_URL_EXPIRY,
    AWS_SES_REGION: process.env.AWS_SES_REGION,
    SES_FROM_EMAIL: process.env.SES_FROM_EMAIL,
    SES_FROM_NAME: process.env.SES_FROM_NAME,
    CLOUDWATCH_LOG_GROUP: process.env.CLOUDWATCH_LOG_GROUP,
    CLOUDWATCH_LOG_STREAM: process.env.CLOUDWATCH_LOG_STREAM,
    ACUITY_USER_ID: process.env.ACUITY_USER_ID,
    ACUITY_API_KEY: process.env.ACUITY_API_KEY,
    ACUITY_BASE_URL: process.env.ACUITY_BASE_URL,
    ACUITY_WEBHOOK_SECRET: process.env.ACUITY_WEBHOOK_SECRET,
    ACUITY_RATE_LIMIT_PER_SECOND: process.env.ACUITY_RATE_LIMIT_PER_SECOND,
    ACUITY_RATE_LIMIT_PER_HOUR: process.env.ACUITY_RATE_LIMIT_PER_HOUR,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    RATE_LIMIT_WINDOW_MS: process.env.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS,
    CACHE_TTL_SHORT: process.env.CACHE_TTL_SHORT,
    CACHE_TTL_LONG: process.env.CACHE_TTL_LONG,
    LOG_LEVEL: process.env.LOG_LEVEL,
    STRUCTURED_LOGGING: process.env.STRUCTURED_LOGGING,
    AUDIT_LOG_ENABLED: process.env.AUDIT_LOG_ENABLED,
    MONITORING_ENABLED: process.env.MONITORING_ENABLED,
    ERROR_REPORTING_DSN: process.env.ERROR_REPORTING_DSN,
    FEATURE_ADMIN_IMPERSONATION: process.env.FEATURE_ADMIN_IMPERSONATION,
    FEATURE_PHONE_VERIFICATION: process.env.FEATURE_PHONE_VERIFICATION,
    FEATURE_SMS_NOTIFICATIONS: process.env.FEATURE_SMS_NOTIFICATIONS,
    FEATURE_DOCUMENT_VIRUS_SCAN: process.env.FEATURE_DOCUMENT_VIRUS_SCAN,
    MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
