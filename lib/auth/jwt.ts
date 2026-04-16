import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/core/env";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export type AdminJwtPayload = {
  sub: string;
  email: string;
  role: string;
};

export async function signAdminJwt(payload: AdminJwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyAdminJwt(token: string) {
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as AdminJwtPayload;
}
