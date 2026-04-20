import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { env } from "@/lib/core/env";
import { opsService } from "@/lib/services/ops-service";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  if (!env.CRON_SECRET) return true;
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  return token === env.CRON_SECRET;
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    if (!isAuthorized(request)) {
      return apiError(requestId, "未授权的定时任务请求", "UNAUTHORIZED", 401);
    }
    const data = await opsService.runDailyMaintenance();
    return apiSuccess(requestId, data, "每日巡检完成");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
