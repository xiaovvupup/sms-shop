import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { AppError } from "@/lib/core/errors";
import { verifyAdminJwt } from "@/lib/auth/jwt";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/core/env";

export const ADMIN_COOKIE_NAME = "admin_token";

export async function requireAdminPageAuth() {
  const cookieStore = cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    redirect("/admin/login");
  }
  try {
    const payload = await verifyAdminJwt(token);
    const user = await prisma.adminUser.findUnique({
      where: { id: payload.sub }
    });
    if (!user || !user.isActive) {
      redirect("/admin/login");
    }
    if (env.ADMIN_SINGLE_ACCOUNT_MODE && user.email !== env.ADMIN_SEED_EMAIL.toLowerCase()) {
      redirect("/admin/login");
    }
    return payload;
  } catch {
    redirect("/admin/login");
  }
}

export async function requireAdminApiAuth(request: NextRequest) {
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) {
    throw new AppError("请先登录管理员账号", "UNAUTHORIZED", 401);
  }
  try {
    const payload = await verifyAdminJwt(token);
    const user = await prisma.adminUser.findUnique({
      where: { id: payload.sub }
    });
    if (!user || !user.isActive) {
      throw new AppError("管理员账号不可用", "UNAUTHORIZED", 401);
    }
    if (env.ADMIN_SINGLE_ACCOUNT_MODE && user.email !== env.ADMIN_SEED_EMAIL.toLowerCase()) {
      throw new AppError("管理员账号不可用", "UNAUTHORIZED", 401);
    }
    return payload;
  } catch {
    throw new AppError("管理员登录状态已失效", "UNAUTHORIZED", 401);
  }
}
