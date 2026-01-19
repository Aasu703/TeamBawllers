import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create CSRF token and set in cookie
 */
export function setCsrfToken(response: NextResponse, token?: string): NextResponse {
  const csrfToken = token || generateCsrfToken();

  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: csrfToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: TOKEN_EXPIRY,
    path: "/",
  });

  return response;
}

/**
 * Get CSRF token from request
 */
export function getCsrfToken(req: NextRequest): string | null {
  // Check header first (from form submission)
  const headerToken = req.headers.get(CSRF_HEADER_NAME);
  if (headerToken) {
    return headerToken;
  }

  // Check cookie
  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  return cookieToken || null;
}

/**
 * Verify CSRF token
 */
export function verifyCsrfToken(req: NextRequest): boolean {
  // Skip verification for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return true;
  }

  const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = req.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Token should match
  return cookieToken === headerToken;
}

/**
 * Middleware to attach CSRF token to responses
 */
export async function attachCsrfToken(response: NextResponse): Promise<NextResponse> {
  const existingToken = response.cookies.get(CSRF_COOKIE_NAME);
  
  if (!existingToken) {
    return setCsrfToken(response, generateCsrfToken());
  }

  return response;
}
