-- Create enum for installment status
CREATE TYPE "InstallmentStatus" AS ENUM ('OPEN', 'OVERDUE', 'PAID');

-- Create table
CREATE TABLE "ContractInstallment" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "baseAmount" DECIMAL(65,30) NOT NULL,
  "penaltyAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "totalDue" DECIMAL(65,30) NOT NULL,
  "status" "InstallmentStatus" NOT NULL DEFAULT 'OPEN',
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContractInstallment_pkey" PRIMARY KEY ("id")
);

-- Add installment relation on payments
ALTER TABLE "Payment"
ADD COLUMN "installmentId" TEXT;

-- Indexes
CREATE UNIQUE INDEX "ContractInstallment_contractId_sequence_key" ON "ContractInstallment"("contractId", "sequence");
CREATE INDEX "ContractInstallment_contractId_status_idx" ON "ContractInstallment"("contractId", "status");
CREATE INDEX "ContractInstallment_dueDate_status_idx" ON "ContractInstallment"("dueDate", "status");
CREATE INDEX "Payment_installmentId_idx" ON "Payment"("installmentId");

-- Foreign keys
ALTER TABLE "ContractInstallment"
ADD CONSTRAINT "ContractInstallment_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_installmentId_fkey"
FOREIGN KEY ("installmentId") REFERENCES "ContractInstallment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
