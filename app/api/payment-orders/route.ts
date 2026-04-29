import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";
import { createPaymentOrderSchema } from "@/lib/validators/schemas";
import { paymentOrderService } from "@/lib/services/payment-order-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`payment-orders:create:${ip}`, env.REDEEM_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }

    const body = createPaymentOrderSchema.parse(await request.json());
    const data = await paymentOrderService.createOrder(body.productId, body.paymentMethod, ip);
    return apiSuccess(requestId, data, "支付订单创建成功");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
