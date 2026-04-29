import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { requireAdminApiAuth } from "@/lib/auth/admin-auth";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";
import { paymentOrderActionSchema } from "@/lib/validators/schemas";
import { paymentOrderService } from "@/lib/services/payment-order-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`admin-payment-orders-confirm:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }

    const admin = await requireAdminApiAuth(request);
    const body = paymentOrderActionSchema.parse(await request.json());
    const data = await paymentOrderService.confirmPaid({
      orderId: body.orderId,
      actorType: "admin",
      actorId: admin.sub,
      paymentChannel: "manual"
    });
    return apiSuccess(requestId, data, "订单已确认到账");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
