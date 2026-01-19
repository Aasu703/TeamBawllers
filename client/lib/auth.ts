import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "auth_token";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  if (process.env.NODE_ENV === "production" && secret === "dev-secret-change-me") {
    throw new Error("JWT secret not configured for production");
  }
  return secret;
}

export function signAuthToken(userId: string, email: string) {
  return jwt.sign({ sub: userId, email }, getJwtSecret(), { expiresIn: "1h" });
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as { sub: string; email: string };
}

export function setAuthCookie(token: string) {
  cookies().set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
}

export function clearAuthCookie() {
  cookies().delete(AUTH_COOKIE);
}
