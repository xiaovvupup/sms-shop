import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";
import { redeemCodeSchema } from "@/lib/validators/schemas";
import { redeemService } from "@/lib/services/redeem-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`redeem:${ip}`, env.REDEEM_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }

    const body = redeemCodeSchema.parse(await request.json());
    const data = await redeemService.redeemCode(body.activationCode, ip);

    return apiSuccess(requestId, data, "激活码校验成功，请确认开始接码");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
