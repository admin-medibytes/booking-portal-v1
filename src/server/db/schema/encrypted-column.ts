import { customType } from 'drizzle-orm/pg-core';
import { encrypt, decrypt } from '@/server/utils/encryption';

export const encryptedText = customType<{
  data: string;
  notNull: true;
  default: false;
}>({
  dataType() {
    return 'text';
  },
  toDriver(value: string): string {
    return encrypt(value);
  },
  fromDriver(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('Expected string value from database');
    }
    try {
      return decrypt(value);
    } catch {
      // If decryption fails, return the original value
      // This handles cases where data might not be encrypted yet
      console.warn('Failed to decrypt value, returning as-is');
      return value;
    }
  },
});

export const encryptedTextNullable = customType<{
  data: string | null;
  notNull: false;
  default: false;
}>({
  dataType() {
    return 'text';
  },
  toDriver(value: string | null): string | null {
    if (value === null) return null;
    return encrypt(value);
  },
  fromDriver(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'string') {
      throw new Error('Expected string value from database');
    }
    try {
      return decrypt(value);
    } catch {
      // If decryption fails, return the original value
      console.warn('Failed to decrypt value, returning as-is');
      return value;
    }
  },
});