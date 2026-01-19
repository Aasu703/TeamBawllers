import DOMPurify from "isomorphic-dompurify";
import { NextRequest } from "next/server";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: any;
}

/**
 * Sanitize HTML input to prevent XSS
 */
export function sanitizeHtml(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a"],
    ALLOWED_ATTR: [],
  });
}

/**
 * Sanitize user input - remove dangerous characters
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") return "";

  return input
    .trim()
    .replace(/[<>\"']/g, "") // Remove HTML special chars
    .slice(0, 1000); // Max 1000 chars
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters" };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: "Password must contain uppercase letter" };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, error: "Password must contain lowercase letter" };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: "Password must contain number" };
  }

  if (!/[!@#$%^&*]/.test(password)) {
    return { valid: false, error: "Password must contain special character (!@#$%^&*)" };
  }

  return { valid: true };
}

/**
 * Validate IP address format
 */
export function validateIpAddress(ip: string): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipRegex.test(ip)) return false;

  const parts = ip.split(".");
  return parts.every((part) => {
    const num = parseInt(part);
    return num >= 0 && num <= 255;
  });
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check request body size
 */
export async function validateRequestSize(
  req: NextRequest,
  maxSizeKb: number = 1024
): Promise<ValidationResult> {
  const contentLength = req.headers.get("content-length");
  if (!contentLength) {
    return { valid: false, error: "Missing content-length header" };
  }

  const sizeKb = parseInt(contentLength) / 1024;
  if (sizeKb > maxSizeKb) {
    return { valid: false, error: `Request too large. Max ${maxSizeKb}KB` };
  }

  return { valid: true };
}

/**
 * Validate JSON payload
 */
export function validateJsonPayload(data: any, schema: Record<string, string>): ValidationResult {
  if (!data || typeof data !== "object") {
    return { valid: false, error: "Invalid JSON payload" };
  }

  for (const [field, type] of Object.entries(schema)) {
    if (!(field in data)) {
      return { valid: false, error: `Missing required field: ${field}` };
    }

    if (typeof data[field] !== type) {
      return {
        valid: false,
        error: `Field ${field} must be ${type}, got ${typeof data[field]}`,
      };
    }
  }

  return { valid: true, data };
}

/**
 * Sanitize all string fields in an object
 */
export function sanitizeObject(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Rate limit check per user/IP
 */
export class RateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();

  check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return true;
    }

    if (entry.count < limit) {
      entry.count++;
      return true;
    }

    return false;
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}
