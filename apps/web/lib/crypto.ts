import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function sealSecret(plaintext: string) {
  return sealBytes(Buffer.from(plaintext, "utf8"));
}

export function sealBytes(value: Uint8Array) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function openSecret(envelope: string) {
  return openBytes(envelope).toString("utf8");
}

export function openBytes(envelope: string) {
  const [version, ivValue, tagValue, encryptedValue] = envelope.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) throw new Error("INVALID_SECRET_ENVELOPE");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]);
}

function encryptionKey() {
  const encoded = process.env.MIRROR_ENCRYPTION_KEY;
  if (!encoded) throw new Error("MIRROR_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("MIRROR_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return key;
}
