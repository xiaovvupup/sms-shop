import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";
import { smsWebhookSchema } from "@/lib/validators/schemas";
import { sessionService } from "@/lib/services/session-service";
import { logger } from "@/lib/core/logger";

export const runtime = "nodejs";

function isIpAllowed(ip: string) {
  const whitelist = env.WEBHOOK_IP_WHITELIST.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (whitelist.length === 0) return true;
  return whitelist.includes(ip);
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    if (!isIpAllowed(ip)) {
      return apiError(requestId, "Webhook IP 不在白名单", "WEBHOOK_IP_FORBIDDEN", 403);
    }

    if (env.WEBHOOK_TOKEN) {
      const token = request.headers.get("x-webhook-token");
      if (token !== env.WEBHOOK_TOKEN) {
        return apiError(requestId, "Webhook token 无效", "WEBHOOK_UNAUTHORIZED", 401);
      }
    }

    const body = smsWebhookSchema.parse(await request.json());
    const data = await sessionService.handleIncomingWebhook({
      activationId: String(body.activationId),
      text: body.text,
      code: body.code,
      receivedAt: body.receivedAt ? new Date(body.receivedAt) : undefined,
      raw: body
    });

    return apiSuccess(requestId, data, "Webhook 已接收");
  } catch (error) {
    logger.warn("Webhook processing failed", {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return handleRouteError(error, requestId);
  }
}
