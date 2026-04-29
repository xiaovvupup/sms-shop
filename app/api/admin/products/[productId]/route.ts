import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { requireAdminApiAuth } from "@/lib/auth/admin-auth";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";
import { productUpdateSchema } from "@/lib/validators/schemas";
import { productService } from "@/lib/services/product-service";

export const runtime = "nodejs";

type RouteContext = {
  params: {
    productId: string;
  };
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`admin-products:update:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }
    const admin = await requireAdminApiAuth(request);
    const body = productUpdateSchema.parse(await request.json());
    const data = await productService.updateProduct(context.params.productId, body, admin.sub);
    return apiSuccess(requestId, data, "商品更新成功");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`admin-products:delete:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }
    const admin = await requireAdminApiAuth(request);
    const data = await productService.deleteProduct(context.params.productId, admin.sub);
    return apiSuccess(requestId, data, "商品已删除");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
