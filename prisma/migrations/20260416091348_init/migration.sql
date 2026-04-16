-- CreateEnum
CREATE TYPE "ActivationCodeStatus" AS ENUM ('unused', 'reserved', 'used', 'expired', 'disabled');

-- CreateEnum
CREATE TYPE "SmsSessionStatus" AS ENUM ('pending', 'number_acquired', 'waiting_sms', 'code_received', 'timeout', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('super_admin', 'operator');

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(14) NOT NULL,
    "status" "ActivationCodeStatus" NOT NULL DEFAULT 'unused',
    "expiresAt" TIMESTAMP(3),
    "reservedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "reservedByIp" VARCHAR(64),
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "note" VARCHAR(120),
    "createdByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsSession" (
    "id" TEXT NOT NULL,
    "activationCodeId" TEXT NOT NULL,
    "providerName" TEXT NOT NULL DEFAULT 'herosms',
    "providerActivationId" TEXT,
    "phoneNumber" VARCHAR(32),
    "status" "SmsSessionStatus" NOT NULL DEFAULT 'pending',
    "timeoutAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "webhookReceivedAt" TIMESTAMP(3),
    "pollAttempts" INTEGER NOT NULL DEFAULT 0,
    "verificationCode" VARCHAR(16),
    "verificationText" TEXT,
    "failureReason" VARCHAR(120),
    "userIp" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "text" TEXT NOT NULL,
    "code" VARCHAR(16),
    "rawPayload" JSONB,
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(120) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "name" VARCHAR(80),
    "role" "AdminRole" NOT NULL DEFAULT 'operator',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" VARCHAR(20) NOT NULL,
    "actorId" VARCHAR(64),
    "action" VARCHAR(80) NOT NULL,
    "entityType" VARCHAR(40) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_code_key" ON "ActivationCode"("code");

-- CreateIndex
CREATE INDEX "ActivationCode_status_createdAt_idx" ON "ActivationCode"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ActivationCode_expiresAt_idx" ON "ActivationCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "SmsSession_providerActivationId_key" ON "SmsSession"("providerActivationId");

-- CreateIndex
CREATE INDEX "SmsSession_status_createdAt_idx" ON "SmsSession"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SmsSession_activationCodeId_idx" ON "SmsSession"("activationCodeId");

-- CreateIndex
CREATE INDEX "SmsSession_phoneNumber_idx" ON "SmsSession"("phoneNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SmsMessage_providerMessageId_key" ON "SmsMessage"("providerMessageId");

-- CreateIndex
CREATE INDEX "SmsMessage_sessionId_createdAt_idx" ON "SmsMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_actorId_createdAt_idx" ON "AuditLog"("actorType", "actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "SmsSession" ADD CONSTRAINT "SmsSession_activationCodeId_fkey" FOREIGN KEY ("activationCodeId") REFERENCES "ActivationCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "SmsSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
