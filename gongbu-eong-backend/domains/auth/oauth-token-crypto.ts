import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

type OAuthProvider = "kakao" | "naver";

const TOKEN_PREFIX = "v1";

export function hashOAuthIdentity(provider: OAuthProvider, providerUserId: string) {
  const secret =
    process.env.OAUTH_IDENTITY_HASH_SECRET ||
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY ||
    "gongbu-eong-dev-oauth-identity";

  return createHmac("sha256", secret)
    .update(`${provider}:${providerUserId}`)
    .digest("hex");
}

export function encryptOAuthToken(token?: string | null) {
  if (!token) return null;

  const key = getTokenEncryptionKey();
  if (!key) return null;

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    TOKEN_PREFIX,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptOAuthToken(encrypted?: string | null) {
  if (!encrypted) return null;

  const key = getTokenEncryptionKey();
  if (!key) return null;

  const [version, ivValue, authTagValue, ciphertextValue] = encrypted.split(":");
  if (version !== TOKEN_PREFIX || !ivValue || !authTagValue || !ciphertextValue) {
    return null;
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivValue, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(authTagValue, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function getTokenEncryptionKey() {
  const value = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!value) return null;

  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }

  const base64Key = Buffer.from(value, "base64");
  if (base64Key.length === 32) {
    return base64Key;
  }

  return createHash("sha256").update(value).digest();
}
