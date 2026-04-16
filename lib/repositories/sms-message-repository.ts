import { prisma } from "@/lib/db/prisma";

export const smsMessageRepository = {
  async create(data: {
    sessionId: string;
    text: string;
    code?: string | null;
    providerMessageId?: string | null;
    receivedAt?: Date;
    rawPayload?: unknown;
  }) {
    return prisma.smsMessage.create({
      data: {
        sessionId: data.sessionId,
        text: data.text,
        code: data.code ?? null,
        providerMessageId: data.providerMessageId ?? null,
        receivedAt: data.receivedAt,
        rawPayload: (data.rawPayload ?? null) as any
      }
    });
  }
};
