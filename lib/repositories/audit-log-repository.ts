import { prisma } from "@/lib/db/prisma";

export const auditLogRepository = {
  async write(input: {
    actorType: "system" | "admin" | "user";
    actorId?: string | null;
    action: string;
    entityType: string;
    entityId: string;
    metadata?: unknown;
  }) {
    return prisma.auditLog.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: (input.metadata ?? null) as any
      }
    });
  }
};
