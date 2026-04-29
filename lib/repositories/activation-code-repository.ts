import { Prisma, ActivationCodeKind, ActivationCodeStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Tx = Prisma.TransactionClient;

function toLegacyActivationCode(code: string) {
  if (code.length !== 12) return code;
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export const activationCodeRepository = {
  async reserveCode(code: string, ip: string, tx: Tx) {
    const now = new Date();
    const result = await tx.activationCode.updateMany({
      where: {
        code,
        status: ActivationCodeStatus.unused,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      data: {
        status: ActivationCodeStatus.reserved,
        reservedAt: now,
        reservedByIp: ip,
        lastUsedAt: now
      }
    });
    return result.count === 1;
  },

  async findByCode(code: string, tx?: Tx) {
    const db = tx ?? prisma;
    const legacy = toLegacyActivationCode(code);
    return db.activationCode.findFirst({
      where: {
        OR: [{ code }, { code: legacy }]
      },
      include: {
        issuedPaymentOrder: true
      }
    });
  },

  async findFirstAvailableForKind(kind: ActivationCodeKind, tx?: Tx) {
    const db = tx ?? prisma;
    const now = new Date();
    return db.activationCode.findFirst({
      where: {
        kind,
        status: ActivationCodeStatus.unused,
        issuedPaymentOrderId: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      },
      orderBy: { createdAt: "asc" }
    });
  },

  async bindToPaymentOrder(id: string, orderId: string, tx: Tx) {
    const result = await tx.activationCode.updateMany({
      where: {
        id,
        issuedPaymentOrderId: null,
        status: ActivationCodeStatus.unused
      },
      data: {
        issuedPaymentOrderId: orderId
      }
    });
    return result.count === 1;
  },

  async releasePaymentOrderBinding(orderId: string, tx?: Tx) {
    const db = tx ?? prisma;
    return db.activationCode.updateMany({
      where: { issuedPaymentOrderId: orderId },
      data: { issuedPaymentOrderId: null }
    });
  },

  async markUsed(id: string, tx?: Tx) {
    const db = tx ?? prisma;
    return db.activationCode.update({
      where: { id },
      data: {
        status: ActivationCodeStatus.used,
        usedAt: new Date(),
        usageCount: { increment: 1 },
        reservedAt: null,
        reservedByIp: null
      }
    });
  },

  async markDisabled(id: string, tx?: Tx) {
    const db = tx ?? prisma;
    return db.activationCode.update({
      where: { id },
      data: {
        status: ActivationCodeStatus.disabled,
        reservedAt: null,
        reservedByIp: null
      }
    });
  },

  async markUnused(
    id: string,
    input?: {
      clearExpiresAt?: boolean;
    },
    tx?: Tx
  ) {
    const db = tx ?? prisma;
    return db.activationCode.update({
      where: { id },
      data: {
        status: ActivationCodeStatus.unused,
        reservedAt: null,
        reservedByIp: null,
        usedAt: null,
        ...(input?.clearExpiresAt ? { expiresAt: null } : {})
      }
    });
  },

  async markReservedById(id: string, ip: string, tx?: Tx) {
    const db = tx ?? prisma;
    return db.activationCode.update({
      where: { id },
      data: {
        status: ActivationCodeStatus.reserved,
        reservedAt: new Date(),
        reservedByIp: ip,
        lastUsedAt: new Date()
      }
    });
  },

  async revertReservedToUnused(id: string, tx?: Tx) {
    const db = tx ?? prisma;
    return db.activationCode.updateMany({
      where: { id, status: ActivationCodeStatus.reserved },
      data: {
        status: ActivationCodeStatus.unused,
        reservedAt: null,
        reservedByIp: null
      }
    });
  },

  async listPaged(params: {
    page: number;
    pageSize: number;
    query?: string;
    status?: ActivationCodeStatus;
    kind?: ActivationCodeKind;
  }) {
    const where: Prisma.ActivationCodeWhereInput = {
      ...(params.query
        ? {
            OR: [{ code: { contains: params.query, mode: "insensitive" } }, { note: { contains: params.query, mode: "insensitive" } }]
          }
        : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.kind ? { kind: params.kind } : {})
    };

    const [items, total] = await prisma.$transaction([
      prisma.activationCode.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize
      }),
      prisma.activationCode.count({ where })
    ]);

    return {
      items,
      total,
      page: params.page,
      pageSize: params.pageSize
    };
  },

  async countAvailableUnused(kind?: ActivationCodeKind) {
    const now = new Date();
    return prisma.activationCode.count({
      where: {
        ...(kind ? { kind } : {}),
        status: ActivationCodeStatus.unused,
        issuedPaymentOrderId: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      }
    });
  },

  async createMany(codes: Array<{ code: string; kind: ActivationCodeKind; expiresAt?: Date; note?: string; createdByAdminId?: string }>) {
    return prisma.activationCode.createMany({
      data: codes,
      skipDuplicates: true
    });
  }
};
