import { Prisma, ActivationCodeStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type Tx = Prisma.TransactionClient;

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
    return db.activationCode.findUnique({
      where: { code }
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
  }) {
    const where: Prisma.ActivationCodeWhereInput = {
      ...(params.query
        ? {
            OR: [{ code: { contains: params.query, mode: "insensitive" } }, { note: { contains: params.query, mode: "insensitive" } }]
          }
        : {}),
      ...(params.status ? { status: params.status } : {})
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

  async createMany(codes: Array<{ code: string; expiresAt?: Date; note?: string; createdByAdminId?: string }>) {
    return prisma.activationCode.createMany({
      data: codes,
      skipDuplicates: true
    });
  }
};
