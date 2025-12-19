import crypto from "crypto";

// Encryption configuration
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment variable
 * In production, this should be a secure, randomly generated key
 */
function getEncryptionKey(): string {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY environment variable is not set. " +
      "Please generate a secure key using: openssl rand -base64 32"
    );
  }
  return key;
}

/**
 * Derive a key from the master key using PBKDF2
 */
function deriveKey(salt: Buffer): Buffer {
  const masterKey = getEncryptionKey();
  return crypto.pbkdf2Sync(masterKey, salt, ITERATIONS, KEY_LENGTH, "sha256");
}

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param data - The data to encrypt (object or string)
 * @returns Base64 encoded encrypted string with salt, IV, auth tag, and ciphertext
 */
export function encryptCredentials(data: Record<string, string>): string {
  const plaintext = JSON.stringify(data);

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from master key
  const key = deriveKey(salt);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + encrypted
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString("base64");
}

/**
 * Decrypt data encrypted with encryptCredentials
 * @param encryptedData - Base64 encoded encrypted string
 * @returns Decrypted data object
 */
export function decryptCredentials(encryptedData: string): Record<string, string> {
  try {
    const combined = Buffer.from(encryptedData, "base64");

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive key
    const key = deriveKey(salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8"));
  } catch (error) {
    // Check if this is legacy Base64-only encoded data
    try {
      const legacyDecoded = JSON.parse(
        Buffer.from(encryptedData, "base64").toString("utf-8")
      );
      // Log warning about legacy data
      console.warn(
        "[Security Warning] Legacy Base64-encoded credentials detected. " +
        "Please re-save the provider to upgrade encryption."
      );
      return legacyDecoded;
    } catch {
      throw new Error("Failed to decrypt credentials: Invalid or corrupted data");
    }
  }
}

/**
 * Check if a string is encrypted with the new AES-256-GCM format
 */
export function isNewEncryptionFormat(encryptedData: string): boolean {
  try {
    const combined = Buffer.from(encryptedData, "base64");
    // New format has at least salt + iv + authTag
    return combined.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
