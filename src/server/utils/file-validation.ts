import { type } from 'arktype';
import { ValidationError } from './errors';
import { env } from '@/lib/env';

// Allowed MIME types for different document types
export const ALLOWED_MIME_TYPES = {
  medical_report: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
  ],
  test_result: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ],
  prescription: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ],
  insurance_card: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/pdf',
  ],
  referral_letter: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/jpg',
    'image/png',
  ],
  other: [
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ],
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  default: 10 * 1024 * 1024, // 10MB
  image: 5 * 1024 * 1024, // 5MB
  document: 20 * 1024 * 1024, // 20MB
} as const;

// Get max file size from env or use default
const getMaxFileSize = (): number => {
  const maxSize = parseInt(env.MAX_FILE_SIZE || '0', 10);
  return maxSize > 0 ? maxSize : FILE_SIZE_LIMITS.default;
};

// File validation schema using ArkType
export const fileUploadSchema = type({
  fileName: type('string').and((name: string) => {
    if (name.length === 0) throw new ValidationError('File name cannot be empty');
    if (name.length > 255) throw new ValidationError('File name must be under 255 characters');
    
    // Check for dangerous file names
    const dangerous = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
    if (dangerous.test(name)) {
      throw new ValidationError('Invalid file name');
    }
    
    // Check for path traversal attempts
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new ValidationError('File name cannot contain path characters');
    }
    
    return name;
  }),
  mimeType: 'string',
  size: type('number').and((size: number) => {
    const maxSize = getMaxFileSize();
    if (size <= 0) throw new ValidationError('File size must be positive');
    if (size > maxSize) throw new ValidationError(`File size must be under ${maxSize} bytes`);
    return size;
  }),
  documentType: type("'medical_report' | 'test_result' | 'prescription' | 'insurance_card' | 'referral_letter' | 'other'"),
});

export type FileUploadInput = typeof fileUploadSchema.infer;

// Validate file upload
export function validateFileUpload(input: unknown): FileUploadInput {
  const result = fileUploadSchema(input);
  
  if (result instanceof type.errors) {
    const firstError = (result as { summary?: string }).summary || 'Validation failed';
    throw new ValidationError(`File validation failed: ${firstError}`);
  }
  
  // Additional MIME type validation based on document type
  const allowedMimes = ALLOWED_MIME_TYPES[result.documentType];
  if (!(allowedMimes as readonly string[]).includes(result.mimeType)) {
    throw new ValidationError(
      `Invalid file type. Allowed types for ${result.documentType}: ${allowedMimes.join(', ')}`,
      'mimeType',
      result.mimeType
    );
  }
  
  // Additional size validation based on file type
  const isImage = result.mimeType.startsWith('image/');
  const maxSize = isImage ? FILE_SIZE_LIMITS.image : FILE_SIZE_LIMITS.document;
  
  if (result.size > maxSize) {
    throw new ValidationError(
      `File too large. Maximum size for ${isImage ? 'images' : 'documents'}: ${maxSize / 1024 / 1024}MB`,
      'size',
      result.size
    );
  }
  
  return result;
}

// Sanitize file name for storage
export function sanitizeFileName(fileName: string): string {
  // Remove any non-alphanumeric characters except dots, dashes, and underscores
  let sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Remove multiple consecutive underscores
  sanitized = sanitized.replace(/_+/g, '_');
  
  // Ensure file has an extension
  if (!sanitized.includes('.')) {
    sanitized += '.bin';
  }
  
  // Limit length
  if (sanitized.length > 100) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, sanitized.lastIndexOf('.'));
    sanitized = name.substring(0, 100 - ext.length) + ext;
  }
  
  return sanitized;
}

// Generate S3 key for file storage
export function generateS3Key(
  organizationId: string,
  bookingId: string,
  documentType: string,
  fileName: string
): string {
  const timestamp = Date.now();
  const sanitized = sanitizeFileName(fileName);
  
  return `organizations/${organizationId}/bookings/${bookingId}/${documentType}/${timestamp}-${sanitized}`;
}

// Check if file needs virus scanning
export function requiresVirusScan(mimeType: string, size: number): boolean {
  if (env.FEATURE_DOCUMENT_VIRUS_SCAN !== 'true') {
    return false;
  }
  
  // Skip virus scan for small images
  if (mimeType.startsWith('image/') && size < 1024 * 1024) { // 1MB
    return false;
  }
  
  // Always scan executables, archives, and office documents
  const riskyTypes = [
    'application/x-msdownload',
    'application/x-executable',
    'application/zip',
    'application/x-rar-compressed',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  
  return riskyTypes.includes(mimeType) || size > 5 * 1024 * 1024; // 5MB
}

// Validate file content matches MIME type (basic check)
export async function validateFileContent(
  buffer: Buffer,
  declaredMimeType: string
): Promise<boolean> {
  // Magic numbers for common file types
  const magicNumbers: Record<string, number[][]> = {
    'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
    'image/jpeg': [[0xFF, 0xD8, 0xFF]], // JPEG
    'image/png': [[0x89, 0x50, 0x4E, 0x47]], // PNG
    'image/gif': [[0x47, 0x49, 0x46]], // GIF
  };
  
  const expectedMagic = magicNumbers[declaredMimeType];
  if (!expectedMagic) {
    // Can't validate unknown types
    return true;
  }
  
  // Check if buffer starts with expected magic numbers
  for (const magic of expectedMagic) {
    let matches = true;
    for (let i = 0; i < magic.length; i++) {
      if (buffer[i] !== magic[i]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return true;
    }
  }
  
  return false;
}