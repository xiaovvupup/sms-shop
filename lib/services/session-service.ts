import { Prisma, SmsSessionStatus } from "@prisma/client";
import { env } from "@/lib/core/env";
import { AppError } from "@/lib/core/errors";
import { extractVerificationCode } from "@/lib/core/utils";
import { prisma } from "@/lib/db/prisma";
import { heroSmsClient } from "@/lib/sms/herosms-client";
import { smsSessionRepository } from "@/lib/repositories/sms-session-repository";
import { auditLogRepository } from "@/lib/repositories/audit-log-repository";
import { activationCodeRepository } from "@/lib/repositories/activation-code-repository";
import { activationCodeFileService } from "@/lib/services/activation-code-file-service";

const TERMINAL_STATUSES = new Set<SmsSessionStatus>([
  SmsSessionStatus.code_received,
  SmsSessionStatus.timeout,
  SmsSessionStatus.failed,
  SmsSessionStatus.cancelled
]);

export const sessionService = {
  async startReceiving(sessionId: string) {
    const session = await smsSessionRepository.findById(sessionId);
    if (!session) {
      throw new AppError("会话不存在", "SESSION_NOT_FOUND", 404);
    }
    if (session.status === SmsSessionStatus.code_received) {
      return this.getSessionDetail(sessionId, false);
    }
    if (session.timeoutAt <= new Date()) {
      await this.markTimeoutAndRelease(
        sessionId,
        session.providerActivationId,
        session.activationCodeId,
        `等待短信超过 ${env.SESSION_TIMEOUT_SECONDS} 秒`
      );
      throw new AppError("会话已超时，请重新输入激活码", "SESSION_TIMEOUT", 410);
    }
    if (
      (session.status === SmsSessionStatus.number_acquired || session.status === SmsSessionStatus.waiting_sms) &&
      session.phoneNumber &&
      session.providerActivationId
    ) {
      return this.getSessionDetail(sessionId, false);
    }
    if (session.status !== SmsSessionStatus.pending) {
      throw new AppError("当前会话状态不允许开始接码", "SESSION_INVALID_STATE", 409);
    }

    const acquire = await heroSmsClient.acquireNumber(session.activationCode.kind);
    await smsSessionRepository.updateAcquired(sessionId, {
      activationId: acquire.activationId,
      phoneNumber: acquire.phoneNumber,
      raw: acquire.raw,
      isNumberChange: false
    });

    await auditLogRepository.write({
      actorType: "user",
      action: "SESSION_START_RECEIVING",
      entityType: "sms_session",
      entityId: sessionId,
      metadata: {
        phoneNumber: acquire.phoneNumber,
        kind: session.activationCode.kind
      }
    });

    return this.getSessionDetail(sessionId, false);
  },

  async changeNumber(sessionId: string) {
    const session = await smsSessionRepository.findById(sessionId);
    if (!session) {
      throw new AppError("会话不存在", "SESSION_NOT_FOUND", 404);
    }
    if (session.timeoutAt <= new Date()) {
      await this.markTimeoutAndRelease(
        sessionId,
        session.providerActivationId,
        session.activationCodeId,
        `等待短信超过 ${env.SESSION_TIMEOUT_SECONDS} 秒`
      );
      throw new AppError("会话已超时，请重新输入激活码", "SESSION_TIMEOUT", 410);
    }
    if (!session.providerActivationId || !session.phoneNumber) {
      throw new AppError("尚未开始接收验证码", "SESSION_NOT_STARTED", 409);
    }
    if (TERMINAL_STATUSES.has(session.status) || session.status === SmsSessionStatus.pending) {
      throw new AppError("当前会话状态不允许换号", "SESSION_INVALID_STATE", 409);
    }
    if (session.numberChangeCount >= env.MAX_NUMBER_CHANGES) {
      throw new AppError("已达到本次会话换号上限", "NUMBER_CHANGE_LIMIT_REACHED", 409);
    }

    const acquiredAt = session.numberAcquiredAt ?? session.startedAt ?? session.createdAt;
    const cooldownEnd = acquiredAt.getTime() + env.CHANGE_NUMBER_COOLDOWN_SECONDS * 1000;
    if (Date.now() < cooldownEnd) {
      const waitSeconds = Math.ceil((cooldownEnd - Date.now()) / 1000);
      throw new AppError(
        `换号还需等待 ${waitSeconds} 秒`,
        "NUMBER_CHANGE_COOLDOWN",
        409,
        { waitSeconds }
      );
    }

    const acquire = await heroSmsClient.acquireNumber(session.activationCode.kind);
    await heroSmsClient.cancelActivation(session.providerActivationId);
    await smsSessionRepository.updateAcquired(sessionId, {
      activationId: acquire.activationId,
      phoneNumber: acquire.phoneNumber,
      raw: acquire.raw,
      isNumberChange: true
    });

    await auditLogRepository.write({
      actorType: "user",
      action: "SESSION_CHANGE_NUMBER",
      entityType: "sms_session",
      entityId: sessionId,
      metadata: {
        phoneNumber: acquire.phoneNumber,
        kind: session.activationCode.kind
      }
    });

    return this.getSessionDetail(sessionId, false);
  },

  async getSessionDetail(sessionId: string, triggerPoll = true) {
    const session = await smsSessionRepository.findById(sessionId);
    if (!session) {
      throw new AppError("会话不存在", "SESSION_NOT_FOUND", 404);
    }

    let currentStatus = session.status;

    if (!TERMINAL_STATUSES.has(currentStatus) && session.timeoutAt <= new Date()) {
      await this.markTimeoutAndRelease(
        session.id,
        session.providerActivationId,
        session.activationCodeId,
        `等待短信超过 ${env.SESSION_TIMEOUT_SECONDS} 秒`
      );
      currentStatus = SmsSessionStatus.timeout;
    }

    if (
      triggerPoll &&
      session.providerActivationId &&
      !TERMINAL_STATUSES.has(currentStatus) &&
      session.status !== SmsSessionStatus.pending &&
      session.timeoutAt > new Date()
    ) {
      await smsSessionRepository.touchPoll(session.id);
      const result = await heroSmsClient.getStatusV2(session.providerActivationId);

      if (result.kind === "received") {
        const code = extractVerificationCode(result.text, result.code);
        const text = result.text ?? "";
        await prisma.$transaction(async (tx) => {
          if (text) {
            await tx.smsMessage.create({
              data: {
                sessionId: session.id,
                text,
                code,
                rawPayload: result.raw as Prisma.InputJsonValue
              }
            });
          }
          await smsSessionRepository.markCodeReceived(session.id, code, text || null, result.raw, tx);
          await activationCodeRepository.markUsed(session.activationCodeId, tx);
        });

        currentStatus = SmsSessionStatus.code_received;
        await heroSmsClient.completeActivation(session.providerActivationId);
        await auditLogRepository.write({
          actorType: "system",
          action: "SESSION_CODE_RECEIVED",
          entityType: "sms_session",
          entityId: session.id,
          metadata: { code }
        });
        await activationCodeFileService.syncTxtSnapshot();
      } else if (result.kind === "cancelled") {
        await this.markCancelledAndRelease(session.id, session.activationCodeId);
        currentStatus = SmsSessionStatus.cancelled;
      } else if (result.kind === "failed") {
        await this.markFailedAndRelease(session.id, result.reason, result.raw, session.activationCodeId);
        currentStatus = SmsSessionStatus.failed;
      }
    }

    const latest = await smsSessionRepository.findById(sessionId);
    if (!latest) {
      throw new AppError("会话不存在", "SESSION_NOT_FOUND", 404);
    }

    const acquiredAt = latest.numberAcquiredAt ?? latest.startedAt ?? latest.createdAt;
    const changeAvailableAt = new Date(acquiredAt.getTime() + env.CHANGE_NUMBER_COOLDOWN_SECONDS * 1000);
    const changeWaitSeconds = Math.max(0, Math.ceil((changeAvailableAt.getTime() - Date.now()) / 1000));
    const canChangeNumber =
      !!latest.providerActivationId &&
      !!latest.phoneNumber &&
      !TERMINAL_STATUSES.has(latest.status) &&
      latest.status !== SmsSessionStatus.pending &&
      latest.timeoutAt > new Date() &&
      latest.numberChangeCount < env.MAX_NUMBER_CHANGES &&
      changeWaitSeconds === 0;

    return {
      sessionId: latest.id,
      activationCode: latest.activationCode.code,
      activationKind: latest.activationCode.kind,
      phoneNumber: latest.phoneNumber,
      status: latest.status,
      verificationCode: latest.verificationCode,
      verificationText: latest.verificationText,
      timeoutAt: latest.timeoutAt,
      pollAttempts: latest.pollAttempts,
      failureReason: latest.failureReason,
      providerActivationId: latest.providerActivationId,
      numberAcquiredAt: latest.numberAcquiredAt,
      numberChangeCount: latest.numberChangeCount,
      maxNumberChanges: env.MAX_NUMBER_CHANGES,
      changeNumberAvailableAt: changeAvailableAt,
      changeNumberWaitSeconds: changeWaitSeconds,
      canStartReceiving: latest.status === SmsSessionStatus.pending && latest.timeoutAt > new Date(),
      canChangeNumber,
      messages: latest.messages.map((item) => ({
        id: item.id,
        text: item.text,
        code: item.code,
        receivedAt: item.receivedAt ?? item.createdAt
      })),
      createdAt: latest.createdAt,
      updatedAt: latest.updatedAt
    };
  },

  async handleIncomingWebhook(input: {
    activationId: string;
    text: string;
    code?: string | null;
    raw: unknown;
    receivedAt?: Date;
  }) {
    const session = await smsSessionRepository.findByProviderActivationId(input.activationId);
    if (!session) {
      throw new AppError("无法匹配到会话", "SESSION_NOT_FOUND", 404);
    }
    if (session.status === SmsSessionStatus.code_received) {
      return { sessionId: session.id };
    }

    const code = extractVerificationCode(input.text, input.code ?? null);
    await prisma.$transaction(async (tx) => {
      await tx.smsMessage.create({
        data: {
          sessionId: session.id,
          text: input.text,
          code,
          receivedAt: input.receivedAt,
          rawPayload: input.raw as Prisma.InputJsonValue
        }
      });
      await smsSessionRepository.markCodeReceived(session.id, code, input.text, input.raw, tx);
      await activationCodeRepository.markUsed(session.activationCodeId, tx);
    });

    await heroSmsClient.completeActivation(input.activationId);
    await auditLogRepository.write({
      actorType: "system",
      action: "WEBHOOK_SMS_RECEIVED",
      entityType: "sms_session",
      entityId: session.id
    });
    await activationCodeFileService.syncTxtSnapshot();

    return { sessionId: session.id };
  },

  async markTimeoutAndRelease(
    sessionId: string,
    activationId?: string | null,
    activationCodeId?: string,
    reason = "SESSION_TIMEOUT"
  ) {
    await prisma.$transaction(async (tx) => {
      await smsSessionRepository.markTimeout(sessionId, reason, tx);
      if (activationCodeId) {
        await activationCodeRepository.revertReservedToUnused(activationCodeId, tx);
      }
    });
    if (activationId) {
      await heroSmsClient.cancelActivation(activationId);
    }
    await activationCodeFileService.syncTxtSnapshot();
  },

  async markFailedAndRelease(
    sessionId: string,
    reason: string,
    raw: unknown,
    activationCodeId: string
  ) {
    await prisma.$transaction(async (tx) => {
      await smsSessionRepository.updateFailed(sessionId, reason, raw, tx);
      await activationCodeRepository.revertReservedToUnused(activationCodeId, tx);
    });
    await activationCodeFileService.syncTxtSnapshot();
  },

  async markCancelledAndRelease(sessionId: string, activationCodeId: string) {
    await prisma.$transaction(async (tx) => {
      await smsSessionRepository.markCancelled(sessionId, "PROVIDER_CANCELLED", tx);
      await activationCodeRepository.revertReservedToUnused(activationCodeId, tx);
    });
    await activationCodeFileService.syncTxtSnapshot();
  }
};
