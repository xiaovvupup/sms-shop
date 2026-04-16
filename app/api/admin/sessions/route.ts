import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { requireAdminApiAuth } from "@/lib/auth/admin-auth";
import { paginationSchema } from "@/lib/validators/schemas";
import { adminService } from "@/lib/services/admin-service";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`admin-sessions:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }

    await requireAdminApiAuth(request);
    const params = paginationSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    const data = await adminService.listSessions(params);
    return apiSuccess(requestId, data);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
