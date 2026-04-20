import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";
import { requireAdminApiAuth } from "@/lib/auth/admin-auth";
import { opsService } from "@/lib/services/ops-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`admin-sms-balance:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }

    const admin = await requireAdminApiAuth(request);
    const data = await opsService.checkSmsBalance("manual", admin.sub);
    return apiSuccess(requestId, data, "余额查询成功");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
