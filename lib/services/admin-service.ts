import bcrypt from "bcryptjs";
import { ActivationCodeStatus, SmsSessionStatus } from "@prisma/client";
import { AppError } from "@/lib/core/errors";
import { generateActivationCode, normalizeActivationCode } from "@/lib/core/utils";
import { signAdminJwt } from "@/lib/auth/jwt";
import { adminUserRepository } from "@/lib/repositories/admin-user-repository";
import { activationCodeRepository } from "@/lib/repositories/activation-code-repository";
import { smsSessionRepository } from "@/lib/repositories/sms-session-repository";
import { auditLogRepository } from "@/lib/repositories/audit-log-repository";
import { activationCodeFileService } from "@/lib/services/activation-code-file-service";

function toCodeDetail(code: {
  id: string;
  code: string;
  status: ActivationCodeStatus;
  usageCount: number;
  expiresAt: Date | null;
  reservedAt: Date | null;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: code.id,
    code: code.code,
    status: code.status,
    usageCount: code.usageCount,
    expiresAt: code.expiresAt,
    reservedAt: code.reservedAt,
    usedAt: code.usedAt,
    createdAt: code.createdAt,
    updatedAt: code.updatedAt
  };
}

export const adminService = {
  async login(email: string, password: string) {
    const user = await adminUserRepository.findByEmail(email);
    if (!user || !user.isActive) {
      throw new AppError("账号不存在或已禁用", "ADMIN_AUTH_FAILED", 401);
    }

    const matched = await bcrypt.compare(password, user.passwordHash);
    if (!matched) {
      throw new AppError("邮箱或密码错误", "ADMIN_AUTH_FAILED", 401);
    }

    await adminUserRepository.touchLastLogin(user.id);
    await auditLogRepository.write({
      actorType: "admin",
      actorId: user.id,
      action: "ADMIN_LOGIN",
      entityType: "admin_user",
      entityId: user.id
    });

    const token = await signAdminJwt({
      sub: user.id,
      email: user.email,
      role: user.role
    });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    };
  },

  async generateCodes(input: {
    count: number;
    expiresAt?: string;
    note?: string;
    adminId: string;
  }) {
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
    const rows: Array<{ code: string; expiresAt?: Date; note?: string; createdByAdminId: string }> = [];
    const generated = new Set<string>();
    while (rows.length < input.count) {
      const code = generateActivationCode();
      if (!generated.has(code)) {
        generated.add(code);
        rows.push({
          code,
          expiresAt,
          note: input.note,
          createdByAdminId: input.adminId
        });
      }
    }

    const result = await activationCodeRepository.createMany(rows);
    await activationCodeFileService.syncTxtSnapshot();
    await auditLogRepository.write({
      actorType: "admin",
      actorId: input.adminId,
      action: "GENERATE_ACTIVATION_CODES",
      entityType: "activation_code",
      entityId: "batch",
      metadata: {
        requestedCount: input.count,
        insertedCount: result.count
      }
    });

    return {
      insertedCount: result.count,
      codes: rows.map((item) => item.code)
    };
  },

  async listCodes(input: { page: number; pageSize: number; query?: string; status?: string }) {
    const status = input.status && input.status !== "all" ? (input.status as ActivationCodeStatus) : undefined;
    return activationCodeRepository.listPaged({
      page: input.page,
      pageSize: input.pageSize,
      query: input.query,
      status
    });
  },

  async listSessions(input: { page: number; pageSize: number; query?: string; status?: string }) {
    const status = input.status && input.status !== "all" ? (input.status as SmsSessionStatus) : undefined;
    return smsSessionRepository.listPaged({
      page: input.page,
      pageSize: input.pageSize,
      query: input.query,
      status
    });
  },

  async checkActivationCode(rawCode: string) {
    const activationCode = normalizeActivationCode(rawCode);
    if (!activationCode) {
      throw new AppError("激活码格式错误，应为 12 位字母数字组合", "INVALID_ACTIVATION_CODE", 422);
    }

    const code = await activationCodeRepository.findByCode(activationCode);
    if (!code) {
      throw new AppError("激活码不存在", "CODE_NOT_FOUND", 404);
    }

    return toCodeDetail(code);
  },

  async disableActivationCode(input: { rawCode: string; adminId: string }) {
    const activationCode = normalizeActivationCode(input.rawCode);
    if (!activationCode) {
      throw new AppError("激活码格式错误，应为 12 位字母数字组合", "INVALID_ACTIVATION_CODE", 422);
    }

    const code = await activationCodeRepository.findByCode(activationCode);
    if (!code) {
      throw new AppError("激活码不存在", "CODE_NOT_FOUND", 404);
    }

    if (code.status === ActivationCodeStatus.disabled) {
      return {
        changed: false,
        detail: toCodeDetail(code)
      };
    }

    if (code.status === ActivationCodeStatus.used) {
      return {
        changed: false,
        detail: toCodeDetail(code)
      };
    }

    const updated = await activationCodeRepository.markDisabled(code.id);
    await activationCodeFileService.syncTxtSnapshot();
    await auditLogRepository.write({
      actorType: "admin",
      actorId: input.adminId,
      action: "DISABLE_ACTIVATION_CODE",
      entityType: "activation_code",
      entityId: updated.id,
      metadata: {
        code: updated.code,
        previousStatus: code.status,
        nextStatus: updated.status
      }
    });

    return {
      changed: true,
      detail: toCodeDetail(updated)
    };
  }
};
