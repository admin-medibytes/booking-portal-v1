import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { env } from '@/lib/env';

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

// Derive encryption key from environment secret
const getEncryptionKey = (): Buffer => {
  const secret = env.ENCRYPTION_KEY || env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error('ENCRYPTION_KEY or BETTER_AUTH_SECRET must be set for data encryption');
  }
  const salt = Buffer.from('medibytes-encryption-salt', 'utf8');
  return scryptSync(secret, salt, KEY_LENGTH);
};

export const encrypt = (text: string): string => {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final()
  ]);
  
  const tag = cipher.getAuthTag();
  
  // Combine iv + tag + encrypted data
  const combined = Buffer.concat([iv, tag, encrypted]);
  
  return combined.toString('base64');
};

export const decrypt = (encryptedText: string): string => {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedText, 'base64');
  
  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);
  
  return decrypted.toString('utf8');
};

// Helper to encrypt/decrypt fields in an object
export const encryptFields = <T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T => {
  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encrypt(result[field] as string) as T[keyof T];
    }
  }
  
  return result;
};

export const decryptFields = <T extends Record<string, unknown>>(
  obj: T,
  fields: (keyof T)[]
): T => {
  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = decrypt(result[field] as string) as T[keyof T];
      } catch (error) {
        // If decryption fails, leave the field as is
        console.error(`Failed to decrypt field ${String(field)}:`, error);
      }
    }
  }
  
  return result;
};

// Fields that should be encrypted in the bookings table
export const ENCRYPTED_BOOKING_FIELDS = [
  'patientFirstName',
  'patientLastName',
  'patientPhone',
  'patientEmail',
  'notes',
  'internalNotes'
] as const;

// Fields that should be encrypted in the documents table
export const ENCRYPTED_DOCUMENT_FIELDS = [
  'fileName',
  's3Key'
] as const;