import bcrypt from "bcryptjs";
import { ActivationCodeStatus, SmsSessionStatus } from "@prisma/client";
import { AppError } from "@/lib/core/errors";
import { generateActivationCode } from "@/lib/core/utils";
import { signAdminJwt } from "@/lib/auth/jwt";
import { adminUserRepository } from "@/lib/repositories/admin-user-repository";
import { activationCodeRepository } from "@/lib/repositories/activation-code-repository";
import { smsSessionRepository } from "@/lib/repositories/sms-session-repository";
import { auditLogRepository } from "@/lib/repositories/audit-log-repository";
import { activationCodeFileService } from "@/lib/services/activation-code-file-service";

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
  }
};
