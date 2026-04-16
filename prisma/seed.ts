import bcrypt from "bcryptjs";
import { PrismaClient, AdminRole } from "@prisma/client";

const prisma = new PrismaClient();
const adminEmail = process.env.ADMIN_SEED_EMAIL ?? "admin@example.com";
const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe123!";
const singleAccountMode = (process.env.ADMIN_SINGLE_ACCOUNT_MODE ?? "true") === "true";

function generateActivationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const values = Array.from(bytes).map((v) => chars[v % chars.length]);
  return `${values.slice(0, 4).join("")}-${values.slice(4, 8).join("")}-${values.slice(8, 12).join("")}`;
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
  if (existing < 10) {
    const rows = Array.from({ length: 10 }).map(() => ({
      code: generateActivationCode(),
      createdByAdminId: admin.id
    }));
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
