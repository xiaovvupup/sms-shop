import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { paymentWebhookSchema } from "@/lib/validators/schemas";
import { paymentOrderService } from "@/lib/services/payment-order-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const body = paymentWebhookSchema.parse(await request.json());
    const data = await paymentOrderService.confirmPaidByWebhook(body);
    return apiSuccess(requestId, data, "支付回调处理成功");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
