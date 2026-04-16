import { env } from "@/lib/core/env";
import { AppError } from "@/lib/core/errors";
import { fetchWithTimeout } from "@/lib/core/timeout";
import { logger } from "@/lib/core/logger";

type SmsStatusResult =
  | { kind: "waiting"; raw: unknown }
  | { kind: "received"; code: string | null; text: string | null; raw: unknown }
  | { kind: "cancelled"; raw: unknown }
  | { kind: "failed"; reason: string; raw: unknown };

type AcquireResult = {
  activationId: string;
  phoneNumber: string;
  raw: unknown;
};

class HeroSmsClient {
  private readonly baseUrl = env.SMS_API_BASE_URL;
  private readonly apiKey = env.SMS_API_KEY;
  private readonly timeoutMs = env.SMS_TIMEOUT_MS;

  private async request(action: string, params: Record<string, string | number | boolean | undefined>) {
    if (!this.apiKey || this.apiKey === "DUMMY_SMS_API_KEY") {
      throw new AppError("SMS_API_KEY 未配置", "SMS_CONFIG_MISSING", 500);
    }
    const url = new URL(this.baseUrl);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("action", action);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetchWithTimeout(url, { method: "GET" }, this.timeoutMs);
    const rawText = await response.text();
    let payload: unknown = rawText;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = rawText;
    }

    if (!response.ok) {
      throw new AppError("SMS 平台请求失败", "SMS_HTTP_ERROR", 502, {
        status: response.status,
        body: payload
      });
    }

    return payload;
  }

  async acquireNumber(): Promise<AcquireResult> {
    const payload = await this.request("getNumberV2", {
      service: env.SMS_SERVICE_CODE,
      country: env.SMS_COUNTRY_CODE,
      maxPrice: env.SMS_MAX_PRICE
    });

    if (typeof payload === "string") {
      if (payload.startsWith("ACCESS_NUMBER:")) {
        const [, activationId, phoneNumber] = payload.split(":");
        if (activationId && phoneNumber) {
          return { activationId, phoneNumber, raw: payload };
        }
      }
      throw new AppError("SMS 平台没有可用号码", "SMS_NUMBER_NOT_AVAILABLE", 503, { payload });
    }

    if (
      payload &&
      typeof payload === "object" &&
      "activationId" in payload &&
      "phoneNumber" in payload
    ) {
      const record = payload as { activationId: string | number; phoneNumber: string };
      return {
        activationId: String(record.activationId),
        phoneNumber: record.phoneNumber,
        raw: payload
      };
    }

    throw new AppError("SMS 平台返回格式异常", "SMS_INVALID_RESPONSE", 502, { payload });
  }

  async getStatusV2(activationId: string): Promise<SmsStatusResult> {
    const payload = await this.request("getStatusV2", {
      id: activationId
    });

    if (typeof payload === "string") {
      if (payload.startsWith("STATUS_OK:")) {
        const code = payload.split(":")[1] ?? null;
        return { kind: "received", code, text: payload, raw: payload };
      }
      if (payload === "STATUS_WAIT_CODE" || payload === "STATUS_WAIT_RETRY" || payload === "STATUS_WAIT_RESEND") {
        return { kind: "waiting", raw: payload };
      }
      if (payload === "STATUS_CANCEL") {
        return { kind: "cancelled", raw: payload };
      }
      return { kind: "failed", reason: payload, raw: payload };
    }

    const smsBlock = (payload as { sms?: { code?: string | null; text?: string | null } })?.sms;
    const code = smsBlock?.code ?? null;
    const text = smsBlock?.text ?? null;
    if (code || text) {
      return { kind: "received", code, text, raw: payload };
    }
    return { kind: "waiting", raw: payload };
  }

  async completeActivation(activationId: string) {
    try {
      await this.request("setStatus", {
        id: activationId,
        status: 6
      });
    } catch (error) {
      logger.warn("Failed to complete activation in provider", {
        activationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async cancelActivation(activationId: string) {
    try {
      await this.request("setStatus", {
        id: activationId,
        status: 8
      });
    } catch (error) {
      logger.warn("Failed to cancel activation in provider", {
        activationId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const heroSmsClient = new HeroSmsClient();
