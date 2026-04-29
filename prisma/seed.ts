import bcrypt from "bcryptjs";
import { ActivationCodeKind, PrismaClient, AdminRole } from "@prisma/client";

const prisma = new PrismaClient();

const WRAPPING_QUOTES_REGEX = /^[`"'“”‘’]+|[`"'“”‘’]+$/g;

function sanitizeEnvString(value: string | undefined, fallback: string) {
  return (value ?? fallback).trim().replace(WRAPPING_QUOTES_REGEX, "");
}

function parseBooleanEnv(value: string | undefined, fallback: boolean) {
  if (!value) return fallback;
  const normalized = value.trim().replace(WRAPPING_QUOTES_REGEX, "").toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
}

const adminEmail = sanitizeEnvString(process.env.ADMIN_SEED_EMAIL, "admin@example.com");
const adminPassword = sanitizeEnvString(process.env.ADMIN_SEED_PASSWORD, "ChangeMe123!");
const singleAccountMode = parseBooleanEnv(process.env.ADMIN_SINGLE_ACCOUNT_MODE, true);

function generateActivationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const values = Array.from(bytes).map((v) => chars[v % chars.length]);
  return values.join("");
}

async function main() {
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      passwordHash,
      role: AdminRole.super_admin,
      isActive: true
    },
    create: {
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: AdminRole.super_admin,
      isActive: true,
      name: "System Admin"
    }
  });

  if (singleAccountMode) {
    await prisma.adminUser.updateMany({
      where: {
        email: {
          not: adminEmail.toLowerCase()
        }
      },
      data: {
        isActive: false
      }
    });
  }

  const existing = await prisma.activationCode.count();
  if (existing < 20) {
    const rows = (["us", "uk"] as ActivationCodeKind[]).flatMap((kind) =>
      Array.from({ length: 10 }).map(() => ({
        code: generateActivationCode(),
        kind,
        createdByAdminId: admin.id
      }))
    );
    await prisma.activationCode.createMany({
      data: rows,
      skipDuplicates: true
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
