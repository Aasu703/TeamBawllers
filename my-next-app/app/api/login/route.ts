import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validators";
import { signAuthToken, setAuthCookie } from "@/lib/auth";
import { redis } from "@/lib/redis";

const FAIL_KEY_PREFIX = "login:fail:";
const LOCK_THRESHOLD = 5;
const LOCK_TTL_SECONDS = 15 * 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }
    const { email, password } = parsed.data;

    const failKey = `${FAIL_KEY_PREFIX}${email}`;
    const failCount = Number((await redis.get(failKey)) || 0);
    const ttl = await redis.ttl(failKey);
    if (failCount >= LOCK_THRESHOLD && ttl > 0) {
      return NextResponse.json(
        { message: "Account locked for 15 minutes due to failed logins" },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await handleFailure(failKey);
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) {
      await handleFailure(failKey);
      return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
    }

    await redis.del(failKey);
    const token = signAuthToken(user.id, user.email);
    setAuthCookie(token);
    return NextResponse.json({ message: "Authenticated" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

async function handleFailure(failKey: string) {
  const count = await redis.incr(failKey);
  if (count === 1) {
    await redis.expire(failKey, LOCK_TTL_SECONDS);
  }
}
