import "server-only";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";

// Constants based on OWASP recommendations (2023)
// https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
const SALT_LENGTH = 32; // 32 bytes = 256 bits
const MEMORY_COST = 65536; // 64 MiB (higher is better, but more resource-intensive)
const TIME_COST = 2; // Number of iterations (higher is better, but slower)
const PARALLELISM = 1; // Number of parallel threads

/**
 * Hashes a password using Argon2id with secure parameters
 * @param password The plaintext password to hash
 * @returns Promise<string> The encoded hash string (includes parameters and salt)
 */
async function hashPassword(password: string): Promise<string> {
  try {
    // Generate a cryptographically secure random salt
    const salt = randomBytes(SALT_LENGTH);

    // Hash the password with Argon2id
    const hash = await argon2.hash(password, {
      // Type of Argon2 variant to use
      type: argon2.argon2id,

      // Memory usage in KiB
      memoryCost: MEMORY_COST,

      // Number of iterations
      timeCost: TIME_COST,

      // Degree of parallelism
      parallelism: PARALLELISM,

      // Salt to use (must be a Buffer)
      salt,

      // Raw buffer output or encoded string
      // (encoded includes all parameters and salt)
      raw: false,
    });

    return hash;
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new Error("Failed to hash password");
  }
}

/**
 * Verifies a password against a stored hash
 * @param password The plaintext password to verify
 * @param hash The stored hash to verify against
 * @returns Promise<boolean> True if password matches, false otherwise
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Verify the password against the stored hash
    // This is timing-safe and handles extracting the parameters from the hash
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error("Error verifying password:", error);
    return false;
  }
}

export { hashPassword, verifyPassword };
