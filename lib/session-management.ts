import { NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days
const ACCESS_TOKEN_COOKIE = "access_token";
const REFRESH_TOKEN_COOKIE = "refresh_token";

export interface SessionPayload {
  userId: string;
  email: string;
  role: "user" | "admin";
  iat?: number;
  exp?: number;
}

/**
 * Sign JWT token with jose
 */
export async function signJwtToken(
  payload: Record<string, any>,
  expiresIn: number
): Promise<string> {
  const encoder = new TextEncoder();
  const secret = encoder.encode(JWT_SECRET);

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
    .sign(secret);

  return token;
}

/**
 * Verify JWT token
 */
export async function verifyJwtToken(token: string): Promise<SessionPayload | null> {
  try {
    const encoder = new TextEncoder();
    const secret = encoder.encode(JWT_SECRET);

    const verified = await jwtVerify(token, secret);
    return verified.payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Create access and refresh tokens
 */
export async function createSessionTokens(
  userId: string,
  email: string,
  role: "user" | "admin" = "user"
): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = { userId, email, role };

  const accessToken = await signJwtToken(payload, ACCESS_TOKEN_EXPIRY);
  const refreshToken = await signJwtToken(
    { ...payload, type: "refresh" },
    REFRESH_TOKEN_EXPIRY
  );

  return { accessToken, refreshToken };
}

/**
 * Set session cookies
 */
export function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set({
    name: ACCESS_TOKEN_COOKIE,
    value: accessToken,
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: ACCESS_TOKEN_EXPIRY,
    path: "/",
  });

  response.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: refreshToken,
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    maxAge: REFRESH_TOKEN_EXPIRY,
    path: "/",
  });

  return response;
}

/**
 * Clear session cookies
 */
export function clearSessionCookies(response: NextResponse): NextResponse {
  response.cookies.delete(ACCESS_TOKEN_COOKIE);
  response.cookies.delete(REFRESH_TOKEN_COOKIE);
  return response;
}

/**
 * Get access token from cookies
 */
export function getAccessToken(req: Request): string | null {
  const headerAuth = req.headers.get("authorization");
  if (headerAuth?.startsWith("Bearer ")) {
    return headerAuth.substring(7);
  }

  return null;
}

/**
 * Check if token is expired
 */
export function isTokenExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt * 1000;
}

