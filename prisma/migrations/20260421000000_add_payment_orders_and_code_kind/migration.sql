-- CreateEnum
CREATE TYPE "ActivationCodeKind" AS ENUM ('us', 'uk');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('pending', 'delivered', 'expired', 'cancelled');

-- AlterTable
ALTER TABLE "ActivationCode" ADD COLUMN     "issuedPaymentOrderId" TEXT,
ADD COLUMN     "kind" "ActivationCodeKind" NOT NULL DEFAULT 'us';

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "orderNo" VARCHAR(24) NOT NULL,
    "kind" "ActivationCodeKind" NOT NULL,
    "amountFen" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'pending',
    "paymentChannel" VARCHAR(40),
    "userIp" VARCHAR(64),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "providerTradeNo" VARCHAR(120),
    "note" VARCHAR(120),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_orderNo_key" ON "PaymentOrder"("orderNo");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_createdAt_idx" ON "PaymentOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_kind_status_createdAt_idx" ON "PaymentOrder"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_expiresAt_idx" ON "PaymentOrder"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_issuedPaymentOrderId_key" ON "ActivationCode"("issuedPaymentOrderId");

-- CreateIndex
CREATE INDEX "ActivationCode_kind_status_createdAt_idx" ON "ActivationCode"("kind", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_issuedPaymentOrderId_fkey" FOREIGN KEY ("issuedPaymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

