/**
 * Workspace secret encryption — AES-256-GCM.
 *
 * Encrypts sensitive workspace data (API keys, tokens) at rest.
 * Uses a 32-byte hex key from the ENCRYPTION_KEY env var.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EncryptedPayload {
  /** Base64-encoded initialization vector (12 bytes) */
  iv: string;
  /** Base64-encoded ciphertext */
  ciphertext: string;
  /** Base64-encoded authentication tag (16 bytes) */
  tag: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits — recommended for GCM
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "Missing required environment variable: ENCRYPTION_KEY (must be 32-byte hex string)",
    );
  }

  const cleaned = hex.replace(/^0x/i, "");

  if (!/^[0-9a-fA-F]+$/.test(cleaned)) {
    throw new Error(
      "ENCRYPTION_KEY must be a hex string (0-9, a-f characters only)",
    );
  }

  const keyBuffer = Buffer.from(cleaned, "hex");
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be exactly ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex characters), got ${keyBuffer.length} bytes`,
    );
  }

  return keyBuffer;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * Returns the IV, ciphertext, and authentication tag as base64 strings.
 * Each call generates a fresh random IV.
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    ciphertext: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypt an AES-256-GCM encrypted payload back to plaintext.
 *
 * Throws if the authentication tag is invalid (tampered data).
 */
export function decrypt(payload: EncryptedPayload): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(payload.iv, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const tag = Buffer.from(payload.tag, "base64");

  if (iv.length !== IV_LENGTH) {
    throw new Error(
      `Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`,
    );
  }

  if (tag.length !== TAG_LENGTH) {
    throw new Error(
      `Invalid tag length: expected ${TAG_LENGTH} bytes, got ${tag.length}`,
    );
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
