import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { requireAdminApiAuth } from "@/lib/auth/admin-auth";
import { adminCodeActionSchema } from "@/lib/validators/schemas";
import { adminService } from "@/lib/services/admin-service";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`admin-codes-check:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }

    await requireAdminApiAuth(request);
    const body = adminCodeActionSchema.parse(await request.json());
    const data = await adminService.checkActivationCode(body.activationCode);
    return apiSuccess(requestId, data, "激活码查询成功");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
