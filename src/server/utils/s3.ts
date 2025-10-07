// lib/spaces.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { sanitizeFileName } from "./file-validation";

// S3 configuration with environment variables from env.ts
const s3Config = {
  region: env.STORAGE_REGION,
  endpoint: env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
  // Enable path-style URLs for Minio compatibility
  forcePathStyle: env.STORAGE_ENDPOINT?.includes('localhost') || env.STORAGE_ENDPOINT?.includes('127.0.0.1'),
};

// Create S3 client
export const s3Client = new S3Client(s3Config);

// Define how long presigned URLs should be valid (15 minutes by default)
export const PRESIGNED_URL_EXPIRATION = 15 * 60; // 15 minutes in seconds

// Get S3 bucket name from environment
export const getS3Bucket = (): string => {
  if (!env.STORAGE_BUCKET) {
    throw new Error("STORAGE_BUCKET environment variable is not set");
  }
  return env.STORAGE_BUCKET;
};

// Helper function to generate a secure, unique file key for S3
export const generateS3Key = (
  bookingId: string,
  fileName: string,
  uploadedByUserId: string
): string => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 15);
  const sanitized = sanitizeFileName(fileName);
  // Format: bookings/{bookingId}/{uploadedByUserId}/{timestamp}-{randomString}-{fileName}
  return `bookings/${bookingId}/${uploadedByUserId}/${timestamp}-${randomString}-${sanitized}`;
};

/**
 * Generate a presigned URL for uploading a file to S3
 * HIPAA Compliance: Uses time-limited URLs (15 minutes) for secure uploads
 */
export const generatePresignedUploadUrl = async (
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> => {
  const bucket = getS3Bucket();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
    Metadata: metadata,
    ServerSideEncryption: "AES256", // Enable server-side encryption (HIPAA requirement)
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRATION,
  });

  return signedUrl;
};

/**
 * Generate a presigned URL for downloading a file from S3
 * HIPAA Compliance: Uses time-limited URLs (15 minutes) for secure downloads
 */
export const generatePresignedDownloadUrl = async (
  key: string,
  fileName?: string
): Promise<string> => {
  const bucket = getS3Bucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: fileName
      ? `attachment; filename="${fileName}"`
      : undefined,
  });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: PRESIGNED_URL_EXPIRATION,
  });

  return signedUrl;
};

/**
 * Delete an object from S3
 */
export const deleteS3Object = async (key: string): Promise<void> => {
  const bucket = getS3Bucket();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3Client.send(command);
};

/**
 * Check if an object exists in S3
 */
export const s3ObjectExists = async (key: string): Promise<boolean> => {
  const bucket = getS3Bucket();

  try {
    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      ("name" in error && error.name === "NotFound" ||
        "$metadata" in error &&
        typeof error.$metadata === "object" &&
        error.$metadata !== null &&
        "httpStatusCode" in error.$metadata &&
        error.$metadata.httpStatusCode === 404)
    ) {
      return false;
    }
    throw error;
  }
};

/**
 * Get object metadata from S3
 */
export const getS3ObjectMetadata = async (
  key: string
): Promise<{ size: number; contentType: string; lastModified: Date }> => {
  const bucket = getS3Bucket();

  const command = new HeadObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  const response = await s3Client.send(command);

  return {
    size: response.ContentLength || 0,
    contentType: response.ContentType || "application/octet-stream",
    lastModified: response.LastModified || new Date(),
  };
};

/**
 * Download object as stream from S3
 * Supports range requests for partial downloads
 */
export const downloadS3ObjectStream = async (
  key: string,
  range?: { start: number; end: number }
): Promise<{
  stream: ReadableStream | null;
  contentLength?: number;
  contentRange?: string;
  acceptRanges?: string;
}> => {
  const bucket = getS3Bucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    Range: range ? `bytes=${range.start}-${range.end}` : undefined,
  });

  const response = await s3Client.send(command);
  const stream = response.Body?.transformToWebStream() || null;

  return {
    stream,
    contentLength: response.ContentLength,
    contentRange: response.ContentRange,
    acceptRanges: response.AcceptRanges,
  };
};
