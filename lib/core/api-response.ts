import { NextResponse } from "next/server";

export type ApiPayload<T> = {
  success: boolean;
  code: string;
  message: string;
  data?: T;
  requestId: string;
  timestamp: string;
};

export function apiSuccess<T>(
  requestId: string,
  data: T,
  message = "OK",
  code = "OK",
  status = 200
) {
  const payload: ApiPayload<T> = {
    success: true,
    code,
    message,
    data,
    requestId,
    timestamp: new Date().toISOString()
  };
  return NextResponse.json(payload, { status });
}

export function apiError(
  requestId: string,
  message: string,
  code: string,
  status = 400,
  details?: unknown
) {
  const payload: ApiPayload<{ details?: unknown }> = {
    success: false,
    code,
    message,
    data: details ? { details } : undefined,
    requestId,
    timestamp: new Date().toISOString()
  };
  return NextResponse.json(payload, { status });
}
