import { ActivationCodeKind } from "@prisma/client";
import { env } from "@/lib/core/env";

export const ACTIVATION_KIND_CONFIG: Record<
  ActivationCodeKind,
  {
    label: string;
    emojiFlag: string;
    englishName: string;
    amountFen: number;
    phonePrefixHint: string;
    smsCountryCode: number;
    smsServiceCode: string;
    paymentQrPayload?: string;
    paymentQrLabel: string;
  }
> = {
  us: {
    label: "美国",
    emojiFlag: "🇺🇸",
    englishName: "United States",
    amountFen: 880,
    phonePrefixHint: "1",
    smsCountryCode: env.SMS_COUNTRY_CODE_US ?? 1,
    smsServiceCode: env.SMS_SERVICE_CODE_US ?? env.SMS_SERVICE_CODE,
    paymentQrPayload: env.PAYMENT_QR_PAYLOAD_US,
    paymentQrLabel: env.PAYMENT_QR_LABEL_US
  },
  uk: {
    label: "英国",
    emojiFlag: "🇬🇧",
    englishName: "United Kingdom",
    amountFen: 388,
    phonePrefixHint: "44",
    smsCountryCode: env.SMS_COUNTRY_CODE_UK ?? 44,
    smsServiceCode: env.SMS_SERVICE_CODE_UK ?? env.SMS_SERVICE_CODE,
    paymentQrPayload: env.PAYMENT_QR_PAYLOAD_UK,
    paymentQrLabel: env.PAYMENT_QR_LABEL_UK
  }
};

export function getActivationKindMeta(kind: ActivationCodeKind) {
  return ACTIVATION_KIND_CONFIG[kind];
}

export function formatFenToYuan(amountFen: number) {
  return (amountFen / 100).toFixed(2).replace(/\.?0+$/, "");
}

export function getActivationKindDisplayName(kind: ActivationCodeKind) {
  const meta = getActivationKindMeta(kind);
  return `${meta.label}${meta.emojiFlag}`;
}
