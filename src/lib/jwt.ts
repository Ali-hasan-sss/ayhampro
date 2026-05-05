import { SignJWT, jwtVerify } from "jose";

const secretKey = process.env.JWT_SECRET ?? "dev-secret";
const key = new TextEncoder().encode(secretKey);
export const AUTH_COOKIE = "taxi_auth";

type AuthPayload = {
  sub: string;
  role: "admin";
};

export async function signAuthToken(payload: AuthPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function verifyAuthToken(token: string) {
  const result = await jwtVerify<AuthPayload>(token, key);
  return result.payload;
}
