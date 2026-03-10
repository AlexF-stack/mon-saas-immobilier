-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('INITIATED', 'FUNDS_ESCROWED', 'LEGAL_VERIFIED', 'COMPLETED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "PurchaseTransaction" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'INITIATED',
    "escrowAmount" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalVerification" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "documentUrl" TEXT,
    "buyerConfirmedAt" TIMESTAMP(3),
    "sellerUploadedAt" TIMESTAMP(3),
    "adminVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseTransaction_propertyId_status_idx" ON "PurchaseTransaction"("propertyId", "status");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_buyerId_createdAt_idx" ON "PurchaseTransaction"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseTransaction_sellerId_createdAt_idx" ON "PurchaseTransaction"("sellerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalVerification_transactionId_key" ON "LegalVerification"("transactionId");

-- CreateIndex
CREATE INDEX "Dispute_transactionId_status_idx" ON "Dispute"("transactionId", "status");

-- AddForeignKey
ALTER TABLE "PurchaseTransaction" ADD CONSTRAINT "PurchaseTransaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseTransaction" ADD CONSTRAINT "PurchaseTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseTransaction" ADD CONSTRAINT "PurchaseTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalVerification" ADD CONSTRAINT "LegalVerification_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PurchaseTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "PurchaseTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
