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
  // Booking document types (HIPAA-compliant)
  booking_document: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
  ],
  // Individual booking document categories
  consent_form: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
  ],
  document_brief: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'video/mp4', // .mp4
  ],
  dictation: [
    'audio/mpeg', // .mp3
    'audio/wav',
    'audio/mp4', // .m4a
    'audio/webm',
    'audio/ogg',
    'audio/x-m4a',
    'application/pdf', // Transcripts
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  ],
  draft_report: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
  ],
  final_report: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
  ],
} as const;

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  default: 512 * 1024 * 1024, // 512MB
  image: 5 * 1024 * 1024, // 5MB
  document: 512 * 1024 * 1024, // 512MB
} as const;

// Get max file size from env or use default
const getMaxFileSize = (): number => {
  const maxSize = parseInt(env.MAX_FILE_SIZE || '0', 10);
  return maxSize > 0 ? maxSize : FILE_SIZE_LIMITS.default;
};

// File validation schema using ArkType
export const fileUploadSchema = type({
  fileName: 'string',
  mimeType: 'string',
  size: 'number',
  documentType: "'medical_report' | 'test_result' | 'prescription' | 'insurance_card' | 'referral_letter' | 'other' | 'booking_document' | 'consent_form' | 'document_brief' | 'dictation' | 'draft_report' | 'final_report'",
});

export type FileUploadInput = typeof fileUploadSchema.infer;

// Validate booking document upload
export function validateBookingDocumentUpload(
  fileName: string,
  mimeType: string,
  fileSize: number,
  category: 'consent_form' | 'document_brief' | 'dictation' | 'draft_report' | 'final_report'
): void {
  // Check file size
  const maxSize = parseInt(env.S3_UPLOAD_MAX_SIZE || '536870912', 10);
  if (fileSize > maxSize) {
    throw new ValidationError(`File size exceeds maximum allowed size of ${maxSize} bytes`);
  }

  // Check MIME type for the specific category
  const allowedMimes = ALLOWED_MIME_TYPES[category];
  if (!(allowedMimes as readonly string[]).includes(mimeType)) {
    throw new ValidationError(
      `Invalid file type for ${category}. Allowed types: ${allowedMimes.join(', ')}`
    );
  }

  // Validate file name
  if (fileName.length === 0) {
    throw new ValidationError('File name cannot be empty');
  }
  if (fileName.length > 255) {
    throw new ValidationError('File name must be under 255 characters');
  }

  // Check for dangerous file names
  const dangerous = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  if (dangerous.test(fileName)) {
    throw new ValidationError('Invalid file name');
  }

  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    throw new ValidationError('File name cannot contain path characters');
  }
}

// Validate file upload
export function validateFileUpload(input: unknown): FileUploadInput {
  const result = fileUploadSchema(input);

  if (result instanceof type.errors) {
    const firstError = (result as { summary?: string }).summary || 'Validation failed';
    throw new ValidationError(`File validation failed: ${firstError}`);
  }

  // Validate file name
  if (result.fileName.length === 0) {
    throw new ValidationError('File name cannot be empty');
  }
  if (result.fileName.length > 255) {
    throw new ValidationError('File name must be under 255 characters');
  }

  // Check for dangerous file names
  const dangerous = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  if (dangerous.test(result.fileName)) {
    throw new ValidationError('Invalid file name');
  }

  // Check for path traversal attempts
  if (result.fileName.includes('..') || result.fileName.includes('/') || result.fileName.includes('\\')) {
    throw new ValidationError('File name cannot contain path characters');
  }

  // Validate file size
  const maxSize = getMaxFileSize();
  if (result.size <= 0) {
    throw new ValidationError('File size must be positive');
  }
  if (result.size > maxSize) {
    throw new ValidationError(`File size must be under ${maxSize} bytes`);
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
  const maxSizeForType = isImage ? FILE_SIZE_LIMITS.image : FILE_SIZE_LIMITS.document;

  if (result.size > maxSizeForType) {
    throw new ValidationError(
      `File too large. Maximum size for ${isImage ? 'images' : 'documents'}: ${maxSizeForType / 1024 / 1024}MB`,
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

// Generate S3 key for file storage (legacy - use generateS3Key from @/server/utils/s3 instead)
export function generateS3KeyLegacy(
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
  
  // Skip virus scan for small images and audio files
  if ((mimeType.startsWith('image/') || mimeType.startsWith('audio/')) && size < 1024 * 1024) { // 1MB
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