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
    const rateLimit = checkRateLimit(`admin-codes-restore:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }

    const admin = await requireAdminApiAuth(request);
    const body = adminCodeActionSchema.parse(await request.json());
    const data = await adminService.restoreActivationCodeToUnused({
      rawCode: body.activationCode,
      adminId: admin.sub
    });

    return apiSuccess(requestId, data, data.changed ? "激活码已恢复为可用状态" : "激活码已是可用状态");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
