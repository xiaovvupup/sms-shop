import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ActivationCodeStatus } from "@prisma/client";
import { env } from "@/lib/core/env";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/core/logger";

const TERMINAL_STATUSES: ActivationCodeStatus[] = [
  ActivationCodeStatus.used,
  ActivationCodeStatus.expired,
  ActivationCodeStatus.disabled
];

export const activationCodeFileService = {
  async syncTxtSnapshot() {
    try {
      const now = new Date();
      const rows = await prisma.activationCode.findMany({
        where: {
          status: { notIn: TERMINAL_STATUSES },
          issuedPaymentOrderId: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
        },
        select: {
          code: true
        },
        orderBy: {
          createdAt: "desc"
        }
      });

      const filePath = path.resolve(process.cwd(), env.ACTIVATION_CODES_TXT_PATH);
      await mkdir(path.dirname(filePath), { recursive: true });
      const content = rows.map((item) => item.code).join("\n");
      await writeFile(filePath, content ? `${content}\n` : "", "utf8");
    } catch (error) {
      logger.warn("Failed to sync activation code txt snapshot", {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
};
