import { randomUUID } from "crypto";
import { ActivationCodeKind, Prisma } from "@prisma/client";
import { AppError } from "@/lib/core/errors";
import { formatFenToYuan, getActivationKindDisplayName, getActivationKindMeta } from "@/lib/core/activation-kind";
import { prisma } from "@/lib/db/prisma";
import { activationCodeRepository } from "@/lib/repositories/activation-code-repository";
import { auditLogRepository } from "@/lib/repositories/audit-log-repository";

function slugifyProductName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  const fallback = `product-${Date.now().toString(36)}`;
  return `${base || fallback}-${randomUUID().slice(0, 8)}`;
}

function yuanToFen(priceYuan: number) {
  const amountFen = Math.round(priceYuan * 100);
  if (!Number.isFinite(amountFen) || amountFen <= 0) {
    throw new AppError("商品售价必须大于 0", "PRODUCT_PRICE_INVALID", 422);
  }
  return amountFen;
}

async function getStockByKind(kinds: ActivationCodeKind[]) {
  const uniqueKinds = [...new Set(kinds)];
  const entries = await Promise.all(uniqueKinds.map(async (kind) => [kind, await activationCodeRepository.countAvailableUnused(kind)] as const));
  return Object.fromEntries(entries) as Record<ActivationCodeKind, number>;
}

function toAdminView(
  product: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    kind: ActivationCodeKind;
    amountFen: number;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  stock: number
) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    kind: product.kind,
    kindDisplayName: getActivationKindDisplayName(product.kind),
    amountFen: product.amountFen,
    amountYuan: formatFenToYuan(product.amountFen),
    sortOrder: product.sortOrder,
    isActive: product.isActive,
    stock,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function toPublicView(
  product: {
    id: string;
    name: string;
    description: string | null;
    kind: ActivationCodeKind;
    amountFen: number;
    sortOrder: number;
  },
  stock: number
) {
  const meta = getActivationKindMeta(product.kind);
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    kind: product.kind,
    kindLabel: meta.label,
    kindDisplayName: getActivationKindDisplayName(product.kind),
    emojiFlag: meta.emojiFlag,
    phonePrefixHint: meta.phonePrefixHint,
    amountFen: product.amountFen,
    amountYuan: formatFenToYuan(product.amountFen),
    stock,
    soldOut: stock <= 0,
    sortOrder: product.sortOrder
  };
}

export const productService = {
  async getPublicProducts() {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    const stockByKind = await getStockByKind(products.map((item) => item.kind));
    return products.map((product) => toPublicView(product, stockByKind[product.kind] ?? 0));
  },

  async listAdminProducts() {
    const products = await prisma.product.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    });
    const stockByKind = await getStockByKind(products.map((item) => item.kind));
    return products.map((product) => toAdminView(product, stockByKind[product.kind] ?? 0));
  },

  async findActiveProductOrThrow(productId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    const product = await db.product.findFirst({
      where: {
        id: productId,
        isActive: true
      }
    });
    if (!product) {
      throw new AppError("商品不存在或已下架", "PRODUCT_NOT_FOUND", 404);
    }
    return product;
  },

  async createProduct(
    input: {
      name: string;
      description?: string;
      kind: ActivationCodeKind;
      priceYuan: number;
      sortOrder?: number;
      isActive?: boolean;
    },
    adminId: string
  ) {
    const product = await prisma.product.create({
      data: {
        slug: slugifyProductName(input.name),
        name: input.name.trim(),
        description: input.description?.trim() || null,
        kind: input.kind,
        amountFen: yuanToFen(input.priceYuan),
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true
      }
    });

    await auditLogRepository.write({
      actorType: "admin",
      actorId: adminId,
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: product.id,
      metadata: {
        name: product.name,
        kind: product.kind,
        amountFen: product.amountFen
      }
    });

    const stockByKind = await getStockByKind([product.kind]);
    return toAdminView(product, stockByKind[product.kind] ?? 0);
  },

  async updateProduct(
    productId: string,
    input: {
      name: string;
      description?: string;
      kind: ActivationCodeKind;
      priceYuan: number;
      sortOrder?: number;
      isActive?: boolean;
    },
    adminId: string
  ) {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new AppError("商品不存在", "PRODUCT_NOT_FOUND", 404);
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        kind: input.kind,
        amountFen: yuanToFen(input.priceYuan),
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true
      }
    });

    await auditLogRepository.write({
      actorType: "admin",
      actorId: adminId,
      action: "PRODUCT_UPDATED",
      entityType: "product",
      entityId: updated.id,
      metadata: {
        previous: {
          name: existing.name,
          kind: existing.kind,
          amountFen: existing.amountFen,
          isActive: existing.isActive
        },
        next: {
          name: updated.name,
          kind: updated.kind,
          amountFen: updated.amountFen,
          isActive: updated.isActive
        }
      }
    });

    const stockByKind = await getStockByKind([updated.kind]);
    return toAdminView(updated, stockByKind[updated.kind] ?? 0);
  },

  async deleteProduct(productId: string, adminId: string) {
    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      throw new AppError("商品不存在", "PRODUCT_NOT_FOUND", 404);
    }

    await prisma.product.delete({ where: { id: productId } });

    await auditLogRepository.write({
      actorType: "admin",
      actorId: adminId,
      action: "PRODUCT_DELETED",
      entityType: "product",
      entityId: productId,
      metadata: {
        name: existing.name,
        kind: existing.kind,
        amountFen: existing.amountFen
      }
    });

    return { deleted: true };
  }
};
