import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatActivationCodeInput(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  return clean.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}

export function normalizeActivationCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (clean.length !== 12) {
    return "";
  }
  return clean.match(/.{1,4}/g)?.join("-") ?? "";
}

export function generateActivationCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(
    (v) => chars[v % chars.length]
  );
  return `${values.slice(0, 4).join("")}-${values.slice(4, 8).join("")}-${values.slice(8, 12).join("")}`;
}

export function extractVerificationCode(text?: string | null, existing?: string | null) {
  if (existing?.trim()) {
    return existing.trim();
  }
  if (!text) {
    return null;
  }
  const match = text.match(/\b\d{4,8}\b/);
  return match?.[0] ?? null;
}

export function getClientIp(headers: Headers): string {
  const xForwardedFor = headers.get("x-forwarded-for");
  if (xForwardedFor) {
    return xForwardedFor.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "0.0.0.0";
}
