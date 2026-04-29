import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { paymentOrderService } from "@/lib/services/payment-order-service";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const rateLimit = checkRateLimit(`payment-orders:get:${params.orderId}`, env.SESSION_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }

    const data = await paymentOrderService.getOrderDetail(params.orderId);
    return apiSuccess(requestId, data);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
