import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { apiError } from "@/lib/core/api-response";
import { AppError } from "@/lib/core/errors";
import { logger } from "@/lib/core/logger";

export async function withRoute<T>(
  fn: (requestId: string) => Promise<T>,
  requestId?: string
): Promise<T> {
  return fn(requestId ?? randomUUID());
}

export function handleRouteError(error: unknown, requestId: string) {
  if (error instanceof ZodError) {
    return apiError(requestId, "请求参数不合法", "VALIDATION_ERROR", 422, error.flatten());
  }
  if (error instanceof AppError) {
    return apiError(requestId, error.message, error.code, error.status, error.details);
  }

  logger.error("Unhandled route error", {
    requestId,
    error: error instanceof Error ? error.message : String(error)
  });
  return apiError(requestId, "服务器内部错误", "INTERNAL_ERROR", 500);
}
