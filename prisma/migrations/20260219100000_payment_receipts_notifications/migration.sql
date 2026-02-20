-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "propertyId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "initiatedById" TEXT;
ALTER TABLE "Payment" ADD COLUMN "initiatedByRole" TEXT;
ALTER TABLE "Payment" ADD COLUMN "receiptNumber" TEXT;
ALTER TABLE "Payment" ADD COLUMN "receiptIssuedAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "ownerNotifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "paymentId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_receiptNumber_key" ON "Payment"("receiptNumber");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_paymentId_idx" ON "Notification"("paymentId");
