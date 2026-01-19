import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { signAuthToken, setAuthCookie } from "@/lib/auth";

// Simple in-memory rate limiting (resets on server restart - fine for hackathon)
const failedAttempts = new Map<string, { count: number; lockedUntil: number }>();
const LOCK_THRESHOLD = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    // Check if account is locked
    const attempt = failedAttempts.get(email);
    if (attempt && attempt.count >= LOCK_THRESHOLD && Date.now() < attempt.lockedUntil) {
      const minutesLeft = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      return NextResponse.json(
        { message: `Account locked. Try again in ${minutesLeft} minutes` },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      handleFailure(email);
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      handleFailure(email);
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    // Success - clear failed attempts
    failedAttempts.delete(email);
    
    const token = signAuthToken(user.id, user.email);
    setAuthCookie(token);
    return NextResponse.json({ message: "Authenticated" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

function handleFailure(email: string) {
  const attempt = failedAttempts.get(email) || { count: 0, lockedUntil: 0 };
  attempt.count++;
  if (attempt.count >= LOCK_THRESHOLD) {
    attempt.lockedUntil = Date.now() + LOCK_DURATION_MS;
  }
  failedAttempts.set(email, attempt);
}
