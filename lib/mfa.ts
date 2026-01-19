import crypto from "crypto";

/**
 * TOTP (Time-based One-Time Password) implementation for MFA
 * Uses standard RFC 4226 HOTP and RFC 6238 TOTP
 */

const TOTP_WINDOW = 30; // seconds
const TOTP_DIGITS = 6;

/**
 * Generate a secret for TOTP
 */
export function generateMfaSecret(): string {
  return crypto.randomBytes(20).toString("base64");
}

/**
 * Generate TOTP token from secret
 */
export function generateTotpToken(secret: string): string {
  const decodedSecret = Buffer.from(secret, "base64");
  const time = Math.floor(Date.now() / 1000 / TOTP_WINDOW);

  const timeBuffer = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    timeBuffer[i] = time & 0xff;
    time >>>= 8;
  }

  const crypto_hmac = require("crypto").createHmac("sha1", decodedSecret);
  crypto_hmac.update(timeBuffer);
  const hmac = crypto_hmac.digest();

  const offset = hmac[hmac.length - 1] & 0xf;
  let code = (hmac[offset] & 0x7f) << 24;
  code |= (hmac[offset + 1] & 0xff) << 16;
  code |= (hmac[offset + 2] & 0xff) << 8;
  code |= hmac[offset + 3] & 0xff;

  code = code % Math.pow(10, TOTP_DIGITS);

  return code.toString().padStart(TOTP_DIGITS, "0");
}

/**
 * Verify TOTP token (allows window for clock skew)
 */
export function verifyTotpToken(secret: string, token: string, window: number = 1): boolean {
  const currentTime = Math.floor(Date.now() / 1000 / TOTP_WINDOW);

  for (let i = -window; i <= window; i++) {
    const testTime = currentTime + i;
    const decodedSecret = Buffer.from(secret, "base64");

    const timeBuffer = Buffer.alloc(8);
    let time = testTime;
    for (let j = 7; j >= 0; j--) {
      timeBuffer[j] = time & 0xff;
      time >>>= 8;
    }

    const crypto_hmac = require("crypto").createHmac("sha1", decodedSecret);
    crypto_hmac.update(timeBuffer);
    const hmac = crypto_hmac.digest();

    const offset = hmac[hmac.length - 1] & 0xf;
    let code = (hmac[offset] & 0x7f) << 24;
    code |= (hmac[offset + 1] & 0xff) << 16;
    code |= (hmac[offset + 2] & 0xff) << 8;
    code |= hmac[offset + 3] & 0xff;

    code = code % Math.pow(10, TOTP_DIGITS);
    const testToken = code.toString().padStart(TOTP_DIGITS, "0");

    if (testToken === token) {
      return true;
    }
  }

  return false;
}

/**
 * Generate backup codes for recovery
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
}

/**
 * Generate QR code URL for authenticator apps
 */
export function generateQrCodeUrl(
  email: string,
  secret: string,
  appName: string = "CyberGuardian"
): string {
  const encodedEmail = encodeURIComponent(email);
  const encodedSecret = encodeURIComponent(secret);
  const encodedAppName = encodeURIComponent(appName);

  // Using standard otpauth:// URI format
  return `otpauth://totp/${encodedAppName}:${encodedEmail}?secret=${encodedSecret}&issuer=${encodedAppName}`;
}

/**
 * Interface for MFA setup
 */
export interface MfaSetup {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

/**
 * Create MFA setup
 */
export function createMfaSetup(email: string): MfaSetup {
  const secret = generateMfaSecret();
  const backupCodes = generateBackupCodes();
  const qrCodeUrl = generateQrCodeUrl(email, secret);

  return {
    secret,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Verify backup code and mark as used
 */
export function verifyBackupCode(
  code: string,
  backupCodes: string[],
  usedCodes: Set<string>
): boolean {
  if (!backupCodes.includes(code)) {
    return false;
  }

  if (usedCodes.has(code)) {
    return false;
  }

  return true;
}

/**
 * Store used backup code
 */
export function markBackupCodeAsUsed(code: string, usedCodes: Set<string>): void {
  usedCodes.add(code);
}
