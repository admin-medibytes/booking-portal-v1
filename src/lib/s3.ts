import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type PutObjectCommandInput,
  type GetObjectCommandInput,
  type DeleteObjectCommandInput,
  type HeadObjectCommandInput,
  type CreateMultipartUploadCommandInput,
  type UploadPartCommandInput,
  type CompleteMultipartUploadCommandInput,
  type AbortMultipartUploadCommandInput,
  type CompletedPart,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";

const s3Client = new S3Client({
  region: env.AWS_S3_REGION || "ap-southeast-2",
  credentials: env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
});

const BUCKET_NAME = env.AWS_S3_BUCKET_NAME;
const MULTIPART_THRESHOLD = 5 * 1024 * 1024; // 5MB
const PART_SIZE = 5 * 1024 * 1024; // 5MB minimum part size

export interface UploadOptions {
  key: string;
  body: Buffer | Uint8Array | ReadableStream;
  contentType: string;
  metadata?: Record<string, string>;
  onProgress?: (progress: number) => void;
}

export interface MultipartUploadOptions extends Omit<UploadOptions, "body"> {
  body: Buffer;
}

export async function uploadObject(options: UploadOptions): Promise<string> {
  const { key, body, contentType, metadata } = options;

  const params: PutObjectCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
    Metadata: metadata,
  };

  try {
    await s3Client.send(new PutObjectCommand(params));
    return key;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw new Error("Failed to upload document");
  }
}

export async function uploadMultipart(options: MultipartUploadOptions): Promise<string> {
  const { key, body, contentType, metadata, onProgress } = options;
  
  const createParams: CreateMultipartUploadCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ServerSideEncryption: "AES256",
    Metadata: metadata,
  };

  let uploadId: string;

  try {
    const createResponse = await s3Client.send(new CreateMultipartUploadCommand(createParams));
    uploadId = createResponse.UploadId!;
  } catch (error) {
    console.error("Error creating multipart upload:", error);
    throw new Error("Failed to initiate multipart upload");
  }

  const parts: CompletedPart[] = [];
  const totalSize = body.length;
  const numParts = Math.ceil(totalSize / PART_SIZE);

  try {
    for (let partNumber = 1; partNumber <= numParts; partNumber++) {
      const start = (partNumber - 1) * PART_SIZE;
      const end = Math.min(start + PART_SIZE, totalSize);
      const partBody = body.slice(start, end);

      const uploadParams: UploadPartCommandInput = {
        Bucket: BUCKET_NAME,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
        Body: partBody,
      };

      const uploadResponse = await s3Client.send(new UploadPartCommand(uploadParams));
      
      parts.push({
        ETag: uploadResponse.ETag,
        PartNumber: partNumber,
      });

      if (onProgress) {
        onProgress((partNumber / numParts) * 100);
      }
    }

    const completeParams: CompleteMultipartUploadCommandInput = {
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    };

    await s3Client.send(new CompleteMultipartUploadCommand(completeParams));
    return key;
  } catch (error) {
    const abortParams: AbortMultipartUploadCommandInput = {
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
    };
    
    try {
      await s3Client.send(new AbortMultipartUploadCommand(abortParams));
    } catch (abortError) {
      console.error("Error aborting multipart upload:", abortError);
    }
    
    console.error("Error during multipart upload:", error);
    throw new Error("Failed to complete multipart upload");
  }
}

export async function getPresignedUrl(key: string, expiresIn = 300): Promise<string> {
  const params: GetObjectCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    const url = await getSignedUrl(s3Client, new GetObjectCommand(params), { expiresIn });
    return url;
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    throw new Error("Failed to generate download URL");
  }
}

export async function downloadObject(key: string): Promise<ReadableStream | null> {
  const params: GetObjectCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    const response = await s3Client.send(new GetObjectCommand(params));
    return response.Body?.transformToWebStream() || null;
  } catch (error) {
    console.error("Error downloading from S3:", error);
    throw new Error("Failed to download document");
  }
}

export async function deleteObject(key: string): Promise<void> {
  const params: DeleteObjectCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    await s3Client.send(new DeleteObjectCommand(params));
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw new Error("Failed to delete document");
  }
}

export async function getObjectMetadata(key: string): Promise<{
  size: number;
  contentType?: string;
  lastModified?: Date;
  metadata?: Record<string, string>;
}> {
  const params: HeadObjectCommandInput = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  try {
    const response = await s3Client.send(new HeadObjectCommand(params));
    return {
      size: response.ContentLength || 0,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
    };
  } catch (error) {
    console.error("Error getting object metadata:", error);
    throw new Error("Failed to get document metadata");
  }
}

export function shouldUseMultipart(size: number): boolean {
  return size > MULTIPART_THRESHOLD;
}