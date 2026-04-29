import { type NextRequest } from "next/server";
import { logger } from "@/lib/core/logger";
import { AppError } from "@/lib/core/errors";
import { zPayClient } from "@/lib/payments/zpay-client";
import { paymentOrderService } from "@/lib/services/payment-order-service";
import { zpayWebhookSchema } from "@/lib/validators/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(new URL(request.url).searchParams.entries());
    const payload = zpayWebhookSchema.parse(params);

    if (!zPayClient.verifySign(params)) {
      throw new AppError("ZPay 回调签名无效", "PAYMENT_WEBHOOK_FORBIDDEN", 403);
    }

    if (payload.trade_status !== "TRADE_SUCCESS") {
      return new Response("success", { status: 200 });
    }

    await paymentOrderService.confirmPaidByZPayNotify({
      orderId: payload.param,
      orderNo: payload.out_trade_no,
      providerTradeNo: payload.trade_no,
      paymentChannel: "alipay",
      note: "ZPAY_WEBHOOK"
    });

    return new Response("success", { status: 200 });
  } catch (error) {
    logger.error("ZPay webhook failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return new Response("fail", { status: 400 });
  }
}
