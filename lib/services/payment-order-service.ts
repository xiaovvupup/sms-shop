import { randomInt } from "crypto";
import QRCode from "qrcode";
import { ActivationCodeKind, PaymentOrder, PaymentOrderStatus, Prisma, PrismaClient } from "@prisma/client";
import { AppError } from "@/lib/core/errors";
import { env } from "@/lib/core/env";
import { formatFenToYuan, getActivationKindMeta } from "@/lib/core/activation-kind";
import { prisma } from "@/lib/db/prisma";
import { activationCodeRepository } from "@/lib/repositories/activation-code-repository";
import { auditLogRepository } from "@/lib/repositories/audit-log-repository";
import { zPayClient } from "@/lib/payments/zpay-client";
import { productService } from "@/lib/services/product-service";

type PaymentOrderWithCode = PaymentOrder & {
  activationCode: {
    id: string;
    code: string;
    kind: ActivationCodeKind;
  } | null;
};

function generateOrderNo() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  const suffix = String(randomInt(1000, 9999));
  return `PO${stamp}${suffix}`;
}

function buildQrPayload(kind: ActivationCodeKind, orderNo: string, amountFen: number) {
  const meta = getActivationKindMeta(kind);
  const payload = meta.paymentQrPayload;
  if (payload?.trim()) {
    return payload
      .replace(/\{\{orderNo\}\}/g, orderNo)
      .replace(/\{\{amount\}\}/g, formatFenToYuan(amountFen));
  }

  return [
    meta.paymentQrLabel,
    `订单号：${orderNo}`,
    `金额：${formatFenToYuan(amountFen)} 元`
  ].join("\n");
}

function getZPayNotifyUrl() {
  return new URL("/api/webhooks/payment/zpay", env.APP_BASE_URL).toString();
}

function buildOrderName(productName: string) {
  return `${env.PAYMENT_SITE_NAME} ${productName}`.slice(0, 64);
}

function toDismissStorageKey(orderId: string) {
  return `payment-order-dismissed:${orderId}`;
}

async function buildQrResult(input: {
  order: PaymentOrderWithCode;
  qrSourceUrl: string | null;
  qrImageUrl: string | null;
  paymentConfigured: boolean;
}) {
  const dataUrl = input.qrSourceUrl
    ? await QRCode.toDataURL(input.qrSourceUrl, {
        margin: 1,
        width: 300
      })
    : await QRCode.toDataURL(buildQrPayload(input.order.kind, input.order.orderNo, input.order.amountFen), {
        margin: 1,
        width: 300
      });

  return {
    qrCodeDataUrl: dataUrl,
    qrCodeImageUrl: input.qrImageUrl,
    qrCodeSourceUrl: input.qrSourceUrl
      ? input.qrSourceUrl
      : buildQrPayload(input.order.kind, input.order.orderNo, input.order.amountFen),
    paymentConfigured: input.paymentConfigured
  };
}

async function toPaymentOrderView(order: PaymentOrderWithCode) {
  const meta = getActivationKindMeta(order.kind);
  const orderMetadata =
    order.metadata && typeof order.metadata === "object" ? (order.metadata as Record<string, unknown>) : {};
  const productName = typeof orderMetadata.productName === "string" ? orderMetadata.productName : `${meta.label}激活码`;
  const qrSourceUrl =
    typeof orderMetadata.qrCodeUrl === "string"
      ? orderMetadata.qrCodeUrl
      : typeof orderMetadata.payUrl === "string"
        ? orderMetadata.payUrl
        : null;
  const qrImageUrl = typeof orderMetadata.qrImageUrl === "string" ? orderMetadata.qrImageUrl : null;
  const qrResult = await buildQrResult({
    order,
    qrSourceUrl,
    qrImageUrl,
    paymentConfigured: zPayClient.isConfigured() || !!meta.paymentQrPayload?.trim()
  });

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    kind: order.kind,
    productName,
    kindLabel: meta.label,
    kindDisplayName: `${meta.label}${meta.emojiFlag}`,
    amountFen: order.amountFen,
    amountYuan: formatFenToYuan(order.amountFen),
    status: order.status,
    expiresAt: order.expiresAt,
    paidAt: order.paidAt,
    deliveredAt: order.deliveredAt,
    paymentChannel: order.paymentChannel,
    providerTradeNo: order.providerTradeNo,
    paymentMethodLabel:
      order.paymentChannel === "alipay" ? "支付宝" : order.paymentChannel === "wxpay" ? "微信支付" : "待选择",
    ...qrResult,
    dismissStorageKey: toDismissStorageKey(order.id),
    activationCode: order.status === PaymentOrderStatus.delivered ? order.activationCode?.code ?? null : null
  };
}

async function findOrderOrThrow(orderId: string, db: Prisma.TransactionClient | PrismaClient = prisma) {
  const order = await db.paymentOrder.findUnique({
    where: { id: orderId },
    include: {
      activationCode: {
        select: {
          id: true,
          code: true,
          kind: true
        }
      }
    }
  });

  if (!order) {
    throw new AppError("订单不存在", "PAYMENT_ORDER_NOT_FOUND", 404);
  }

  return order;
}

async function findOrderByOrderNoOrThrow(orderNo: string, db: Prisma.TransactionClient | PrismaClient = prisma) {
  const order = await db.paymentOrder.findFirst({
    where: { orderNo },
    include: {
      activationCode: {
        select: {
          id: true,
          code: true,
          kind: true
        }
      }
    }
  });

  if (!order) {
    throw new AppError("订单不存在", "PAYMENT_ORDER_NOT_FOUND", 404);
  }

  return order;
}

export const paymentOrderService = {
  async createOrder(productId: string, paymentMethod: "alipay" | "wxpay", userIp: string) {
    if (paymentMethod !== "alipay") {
      throw new AppError("微信支付暂未接入，建议使用支付宝支付", "PAYMENT_METHOD_NOT_SUPPORTED", 422);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let provisionalOrderId: string | null = null;
      try {
        const order = await prisma.$transaction(
          async (tx) => {
            const product = await productService.findActiveProductOrThrow(productId, tx);
            const meta = getActivationKindMeta(product.kind);
            const activationCode = await activationCodeRepository.findFirstAvailableForKind(product.kind, tx);
            if (!activationCode) {
              throw new AppError(`${meta.label}激活码暂时缺货，请稍后再试`, "ACTIVATION_CODE_OUT_OF_STOCK", 409);
            }

            const order = await tx.paymentOrder.create({
              data: {
                orderNo: generateOrderNo(),
                kind: product.kind,
                amountFen: product.amountFen,
                paymentChannel: paymentMethod,
                userIp,
                expiresAt: new Date(Date.now() + env.PAYMENT_ORDER_EXPIRE_MINUTES * 60_000),
                metadata: {
                  productId: product.id,
                  productName: product.name
                }
              },
              include: {
                activationCode: {
                  select: {
                    id: true,
                    code: true,
                    kind: true
                  }
                }
              }
            });

            const bound = await activationCodeRepository.bindToPaymentOrder(activationCode.id, order.id, tx);
            if (!bound) {
              throw new AppError("订单创建过于频繁，请重试", "PAYMENT_ORDER_BIND_FAILED", 409);
            }

            return tx.paymentOrder.findUniqueOrThrow({
              where: { id: order.id },
              include: {
                activationCode: {
                  select: {
                    id: true,
                    code: true,
                    kind: true
                  }
                }
              }
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
        provisionalOrderId = order.id;

        let finalOrder = order;
        if (zPayClient.isConfigured()) {
          const metadata =
            order.metadata && typeof order.metadata === "object" ? (order.metadata as Record<string, unknown>) : {};
          const productName =
            typeof metadata.productName === "string" ? metadata.productName : `${getActivationKindMeta(order.kind).label}激活码`;
          const upstream = await zPayClient.createOrder({
            outTradeNo: order.orderNo,
            name: buildOrderName(productName),
            money: formatFenToYuan(order.amountFen),
            notifyUrl: getZPayNotifyUrl(),
            clientIp: userIp,
            method: "alipay",
            param: order.id
          });

          finalOrder = await prisma.paymentOrder.update({
            where: { id: order.id },
            data: {
              paymentChannel: paymentMethod,
              providerTradeNo: upstream.providerTradeNo,
              metadata: {
                ...metadata,
                provider: "zpay",
                qrCodeUrl: upstream.qrCodeUrl,
                qrImageUrl: upstream.qrImageUrl,
                payUrl: upstream.payUrl,
                payUrl2: upstream.payUrl2,
                raw: upstream.raw as Prisma.InputJsonValue
              }
            },
            include: {
              activationCode: {
                select: {
                  id: true,
                  code: true,
                  kind: true
                }
              }
            }
          });
        }

        await auditLogRepository.write({
          actorType: "user",
          action: "PAYMENT_ORDER_CREATED",
          entityType: "payment_order",
          entityId: finalOrder.id,
          metadata: {
            orderNo: finalOrder.orderNo,
            kind: finalOrder.kind,
            productId,
            amountFen: finalOrder.amountFen,
            paymentMethod
          }
        });

        return toPaymentOrderView(finalOrder);
      } catch (error) {
        if (provisionalOrderId) {
          const orderId = provisionalOrderId;
          await prisma.$transaction(async (tx) => {
            await tx.paymentOrder.updateMany({
              where: {
                id: orderId,
                status: PaymentOrderStatus.pending
              },
              data: {
                status: PaymentOrderStatus.cancelled,
                cancelledAt: new Date(),
                note: "PAYMENT_PROVIDER_CREATE_FAILED"
              }
            });
            await activationCodeRepository.releasePaymentOrderBinding(orderId, tx);
          });
        }
        if (attempt < 2 && error instanceof AppError && error.code === "PAYMENT_ORDER_BIND_FAILED") {
          continue;
        }
        throw error;
      }
    }

    throw new AppError("订单创建失败，请重试", "PAYMENT_ORDER_CREATE_FAILED", 409);
  },

  async getOrderDetail(orderId: string) {
    const now = new Date();
    let order = await findOrderOrThrow(orderId);

    if (order.status === PaymentOrderStatus.pending && order.expiresAt <= now) {
      order = await prisma.$transaction(async (tx) => {
        await tx.paymentOrder.update({
          where: { id: orderId },
          data: {
            status: PaymentOrderStatus.expired
          }
        });
        await activationCodeRepository.releasePaymentOrderBinding(orderId, tx);
        return findOrderOrThrow(orderId, tx);
      });
    }

    return toPaymentOrderView(order);
  },

  async reconcilePendingOrder(orderId: string) {
    const order = await findOrderOrThrow(orderId);
    if (order.status !== PaymentOrderStatus.pending) {
      return toPaymentOrderView(order);
    }

    if (order.expiresAt <= new Date()) {
      return this.getOrderDetail(orderId);
    }

    if (!zPayClient.isConfigured()) {
      return toPaymentOrderView(order);
    }

    const result = await zPayClient.queryOrder(order.orderNo);
    if (!result.paid) {
      return toPaymentOrderView(order);
    }

    return this.confirmPaid({
      orderId,
      actorType: "system",
      paymentChannel: order.paymentChannel ?? "alipay",
      providerTradeNo: result.providerTradeNo ?? undefined,
      note: "ZPAY_RECONCILED_BY_QUERY"
    });
  },

  async findByKeyword(keyword: string) {
    const value = keyword.trim();
    if (!value) {
      throw new AppError("请输入订单号", "PAYMENT_ORDER_KEYWORD_REQUIRED", 422);
    }

    const order = await prisma.paymentOrder.findFirst({
      where: {
        OR: [{ id: value }, { orderNo: value }]
      },
      include: {
        activationCode: {
          select: {
            id: true,
            code: true,
            kind: true
          }
        }
      }
    });

    if (!order) {
      throw new AppError("未找到对应订单", "PAYMENT_ORDER_NOT_FOUND", 404);
    }

    return this.getOrderDetail(order.id);
  },

  async confirmPaid(input: {
    orderId: string;
    actorType: "admin" | "system";
    actorId?: string | null;
    paymentChannel?: string;
    providerTradeNo?: string;
    note?: string;
  }) {
    const order = await findOrderOrThrow(input.orderId);

    if (order.status === PaymentOrderStatus.delivered) {
      return toPaymentOrderView(order);
    }

    if (order.status === PaymentOrderStatus.cancelled) {
      throw new AppError("订单已取消，不能再次确认到账", "PAYMENT_ORDER_CANCELLED", 409);
    }

    if (order.status === PaymentOrderStatus.expired || order.expiresAt <= new Date()) {
      if (order.status !== PaymentOrderStatus.expired) {
        await prisma.$transaction(async (tx) => {
          await tx.paymentOrder.update({
            where: { id: order.id },
            data: {
              status: PaymentOrderStatus.expired
            }
          });
          await activationCodeRepository.releasePaymentOrderBinding(order.id, tx);
        });
      }
      throw new AppError("订单已过期，请重新下单", "PAYMENT_ORDER_EXPIRED", 410);
    }

    if (!order.activationCode) {
      throw new AppError("订单未锁定激活码，请补码后重试", "PAYMENT_ORDER_CODE_MISSING", 409);
    }

    const updated = await prisma.paymentOrder.update({
      where: { id: input.orderId },
      data: {
        status: PaymentOrderStatus.delivered,
        paidAt: new Date(),
        deliveredAt: new Date(),
        paymentChannel: input.paymentChannel ?? order.paymentChannel ?? "qr",
        providerTradeNo: input.providerTradeNo,
        note: input.note
      },
      include: {
        activationCode: {
          select: {
            id: true,
            code: true,
            kind: true
          }
        }
      }
    });

    await auditLogRepository.write({
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: "PAYMENT_ORDER_CONFIRMED",
      entityType: "payment_order",
      entityId: updated.id,
      metadata: {
        orderNo: updated.orderNo,
        kind: updated.kind,
        amountFen: updated.amountFen,
        paymentChannel: updated.paymentChannel,
        providerTradeNo: updated.providerTradeNo
      }
    });

    return toPaymentOrderView(updated);
  },

  async confirmPaidByZPayNotify(input: {
    orderId?: string;
    orderNo: string;
    providerTradeNo: string;
    paymentChannel?: string;
    note?: string;
  }) {
    const order = input.orderId ? await findOrderOrThrow(input.orderId) : await findOrderByOrderNoOrThrow(input.orderNo);
    return this.confirmPaid({
      orderId: order.id,
      actorType: "system",
      paymentChannel: input.paymentChannel ?? order.paymentChannel ?? "alipay",
      providerTradeNo: input.providerTradeNo,
      note: input.note ?? "ZPAY_WEBHOOK"
    });
  },

  async confirmPaidByWebhook(input: {
    orderId: string;
    secret: string;
    providerTradeNo?: string;
    note?: string;
  }) {
    if (!env.PAYMENT_WEBHOOK_SECRET || input.secret !== env.PAYMENT_WEBHOOK_SECRET) {
      throw new AppError("支付回调签名无效", "PAYMENT_WEBHOOK_FORBIDDEN", 403);
    }

    return this.confirmPaid({
      orderId: input.orderId,
      actorType: "system",
      paymentChannel: "webhook",
      providerTradeNo: input.providerTradeNo,
      note: input.note
    });
  }
};
