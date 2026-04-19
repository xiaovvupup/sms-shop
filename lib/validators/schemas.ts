import { z } from "zod";

export const redeemCodeSchema = z.object({
  activationCode: z.string().min(1).max(64)
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
});

export const generateCodesSchema = z.object({
  count: z.coerce.number().int().min(1).max(500),
  expiresAt: z.string().datetime().optional(),
  note: z.string().max(120).optional()
});

export const adminCodeActionSchema = z.object({
  activationCode: z.string().min(1).max(64)
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  query: z.string().max(100).optional(),
  status: z.string().max(40).optional()
});

export const smsWebhookSchema = z.object({
  activationId: z.union([z.string(), z.number()]),
  service: z.string().min(1),
  text: z.string().default(""),
  code: z.string().optional().nullable(),
  country: z.union([z.string(), z.number()]).optional(),
  receivedAt: z.string().datetime().optional()
});
