import crypto from "node:crypto";

export function sanitizeText(value: string, maxLength = 20_000): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .slice(0, maxLength)
    .trim();
}

export function verifyRazorpaySignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature) {
    return false;
  }

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function createApiKey(): string {
  return `sx_${crypto.randomBytes(32).toString("base64url")}`;
}

export function hashSecret(secret: string): string {
  return crypto.createHash("sha256").update(secret).digest("hex");
}
