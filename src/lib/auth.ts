import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { AUTH_COOKIE, signAuthToken, verifyAuthToken } from "@/lib/jwt";

export { AUTH_COOKIE, signAuthToken, verifyAuthToken };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hashed: string) {
  return bcrypt.compare(password, hashed);
}

export async function requireAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;

  if (!token) return null;
  try {
    const payload = await verifyAuthToken(token);
    return payload;
  } catch {
    return null;
  }
}
