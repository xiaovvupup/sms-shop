-- AlterTable
ALTER TABLE "SmsSession" ADD COLUMN     "numberAcquiredAt" TIMESTAMP(3),
ADD COLUMN     "numberChangeCount" INTEGER NOT NULL DEFAULT 0;
