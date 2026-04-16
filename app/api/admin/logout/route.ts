import { randomUUID } from "crypto";
import { apiSuccess } from "@/lib/core/api-response";
import { ADMIN_COOKIE_NAME } from "@/lib/auth/admin-auth";

export const runtime = "nodejs";

export async function POST() {
  const requestId = randomUUID();
  const response = apiSuccess(requestId, {}, "退出成功");
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    path: "/",
    expires: new Date(0)
  });
  return response;
}
