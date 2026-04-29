import { randomUUID } from "crypto";
import { apiSuccess } from "@/lib/core/api-response";
import { handleRouteError } from "@/lib/api/route-helpers";
import { productService } from "@/lib/services/product-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  try {
    const data = await productService.getPublicProducts();
    return apiSuccess(requestId, data);
  } catch (error) {
    return handleRouteError(error, requestId);
  }
}
