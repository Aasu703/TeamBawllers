import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Add security headers to response
 * @param response - NextResponse to add headers to
 * @returns NextResponse with security headers
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy - prevents XSS and other injection attacks
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none';"
  );

  response.headers.set("X-Frame-Options", "DENY");

  response.headers.set("X-Content-Type-Options", "nosniff");

  response.headers.set("X-XSS-Protection", "1; mode=block");

  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  response.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=(), payment=()"
  );

  response.headers.set("X-DNS-Prefetch-Control", "off");

  return response;
}

/**
 * Get CORS headers for response
 * @param origin - Request origin
 * @returns Object with CORS headers
 */
export function getCorsHeaders(origin?: string) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000").split(",");
  const isAllowed = allowedOrigins.includes(origin || "");

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle CORS pre-flight requests
 * @param req - NextRequest
 * @returns NextResponse with CORS headers
 */
export function handleCorsPreFlight(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = getCorsHeaders(origin || "");

  return new NextResponse(null, {
    status: 200,
    headers,
  });
}
