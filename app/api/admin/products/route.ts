import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { requireAdminApiAuth } from "@/lib/auth/admin-auth";
import { checkRateLimit } from "@/lib/core/rate-limit";
import { env } from "@/lib/core/env";
import { getClientIp } from "@/lib/core/utils";
import { productCreateSchema } from "@/lib/validators/schemas";
import { productService } from "@/lib/services/product-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`admin-products:list:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }
    await requireAdminApiAuth(request);
    const data = await productService.listAdminProducts();
    return apiSuccess(requestId, data);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const ip = getClientIp(request.headers);
    const rateLimit = checkRateLimit(`admin-products:create:${ip}`, env.ADMIN_RATE_LIMIT, 60_000);
    if (!rateLimit.allowed) {
      return apiError(requestId, "请求过于频繁，请稍后重试", "RATE_LIMITED", 429);
    }
    const admin = await requireAdminApiAuth(request);
    const body = productCreateSchema.parse(await request.json());
    const data = await productService.createProduct(body, admin.sub);
    return apiSuccess(requestId, data, "商品创建成功");
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
