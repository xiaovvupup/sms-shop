import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";
import { adminLoginSchema } from "@/lib/validators/schemas";
import { adminService } from "@/lib/services/admin-service";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`admin-login:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "登录请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }

    const body = adminLoginSchema.parse(await request.json());
    const result = await adminService.login(body.email, body.password);
    const response = apiSuccess(requestId, { user: result.user }, "登录成功");
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: result.token,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });
    return response;
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
