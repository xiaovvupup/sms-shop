import { createHash } from "crypto";
import { env } from "@/lib/core/env";
import { AppError } from "@/lib/core/errors";

export type ZPayMethod = "alipay";

type CreateZPayOrderInput = {
  outTradeNo: string;
  name: string;
  money: string;
  notifyUrl: string;
  clientIp: string;
  method: ZPayMethod;
  param?: string;
};

type CreateZPayOrderResult = {
  providerTradeNo: string | null;
  payUrl: string | null;
  payUrl2: string | null;
  qrCodeUrl: string | null;
  qrImageUrl: string | null;
  raw: unknown;
};

type QueryZPayOrderResult = {
  paid: boolean;
  providerTradeNo: string | null;
  buyer: string | null;
  raw: unknown;
};

function normalizeValue(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

function isZPayConfigured() {
  return !!(env.ZPAY_API_BASE_URL && env.ZPAY_PID && env.ZPAY_KEY);
}

function createZPaySign(params: Record<string, unknown>) {
  const pairs = Object.entries(params)
    .filter(([key, value]) => key !== "sign" && key !== "sign_type" && normalizeValue(value) !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${normalizeValue(value)}`);

  return createHash("md5")
    .update(`${pairs.join("&")}${env.ZPAY_KEY ?? ""}`, "utf8")
    .digest("hex");
}

function resolveChannelId(method: ZPayMethod) {
  return method === "alipay" ? env.ZPAY_ALIPAY_CID : undefined;
}

async function parseJsonSafe(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export const zPayClient = {
  isConfigured() {
    return isZPayConfigured();
  },

  verifySign(params: Record<string, unknown>) {
    const incoming = normalizeValue(params.sign).toLowerCase();
    const expected = createZPaySign(params).toLowerCase();
    return incoming !== "" && incoming === expected;
  },

  async createOrder(input: CreateZPayOrderInput): Promise<CreateZPayOrderResult> {
    if (!isZPayConfigured()) {
      throw new AppError("ZPay 支付参数未配置", "PAYMENT_PROVIDER_NOT_CONFIGURED", 500);
    }

    const params = {
      pid: env.ZPAY_PID,
      cid: resolveChannelId(input.method),
      type: input.method,
      out_trade_no: input.outTradeNo,
      notify_url: input.notifyUrl,
      name: input.name,
      money: input.money,
      clientip: input.clientIp,
      device: "pc",
      param: input.param,
      sign_type: "MD5"
    };

    const body = new FormData();
    Object.entries(params).forEach(([key, value]) => {
      if (normalizeValue(value) !== "") {
        body.append(key, normalizeValue(value));
      }
    });
    body.append("sign", createZPaySign(params));

    const url = new URL("/mapi.php", env.ZPAY_API_BASE_URL);
    const response = await fetch(url, {
      method: "POST",
      body
    });
    const payload = await parseJsonSafe(response);

    if (!response.ok) {
      throw new AppError("ZPay 下单失败", "PAYMENT_PROVIDER_HTTP_ERROR", 502, payload);
    }

    if (!payload || typeof payload !== "object") {
      throw new AppError("ZPay 下单返回格式异常", "PAYMENT_PROVIDER_INVALID_RESPONSE", 502, payload);
    }

    const record = payload as Record<string, unknown>;
    if (Number(record.code) !== 1) {
      throw new AppError(
        normalizeValue(record.msg) || "ZPay 下单失败",
        "PAYMENT_PROVIDER_CREATE_FAILED",
        502,
        payload
      );
    }

    return {
      providerTradeNo: normalizeValue(record.trade_no) || normalizeValue(record.O_id) || null,
      payUrl: normalizeValue(record.payurl) || null,
      payUrl2: normalizeValue(record.payurl2) || null,
      qrCodeUrl: normalizeValue(record.qrcode) || normalizeValue(record.payurl) || null,
      qrImageUrl: normalizeValue(record.img) || null,
      raw: payload
    };
  },

  async queryOrder(outTradeNo: string): Promise<QueryZPayOrderResult> {
    if (!isZPayConfigured()) {
      throw new AppError("ZPay 支付参数未配置", "PAYMENT_PROVIDER_NOT_CONFIGURED", 500);
    }

    const url = new URL("/api.php", env.ZPAY_API_BASE_URL);
    url.searchParams.set("act", "order");
    url.searchParams.set("pid", env.ZPAY_PID ?? "");
    url.searchParams.set("key", env.ZPAY_KEY ?? "");
    url.searchParams.set("out_trade_no", outTradeNo);

    const response = await fetch(url, { method: "GET" });
    const payload = await parseJsonSafe(response);

    if (!response.ok) {
      throw new AppError("ZPay 查单失败", "PAYMENT_PROVIDER_QUERY_HTTP_ERROR", 502, payload);
    }

    if (!payload || typeof payload !== "object") {
      throw new AppError("ZPay 查单返回格式异常", "PAYMENT_PROVIDER_QUERY_INVALID_RESPONSE", 502, payload);
    }

    const record = payload as Record<string, unknown>;
    if (Number(record.code) !== 1) {
      throw new AppError(
        normalizeValue(record.msg) || "ZPay 查单失败",
        "PAYMENT_PROVIDER_QUERY_FAILED",
        502,
        payload
      );
    }

    return {
      paid: normalizeValue(record.status) === "1",
      providerTradeNo: normalizeValue(record.trade_no) || null,
      buyer: normalizeValue(record.buyer) || null,
      raw: payload
    };
  }
};
