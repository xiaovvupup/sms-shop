import { prisma } from "@/lib/db/prisma";

export const adminUserRepository = {
  async findByEmail(email: string) {
    return prisma.adminUser.findUnique({
      where: { email: email.toLowerCase() }
    });
  },

  async touchLastLogin(id: string) {
    return prisma.adminUser.update({
      where: { id },
      data: { lastLoginAt: new Date() }
    });
  }
};
