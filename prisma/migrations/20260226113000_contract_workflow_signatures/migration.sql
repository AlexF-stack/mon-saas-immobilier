ALTER TABLE "Contract"
ADD COLUMN "contractType" TEXT NOT NULL DEFAULT 'RENTAL',
ADD COLUMN "workflowState" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "documentSource" TEXT,
ADD COLUMN "contractText" TEXT,
ADD COLUMN "receiptFileUrl" TEXT,
ADD COLUMN "receiptText" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "ownerSignedAt" TIMESTAMP(3),
ADD COLUMN "tenantSignedAt" TIMESTAMP(3),
ADD COLUMN "paymentInitiatedAt" TIMESTAMP(3),
ADD COLUMN "activatedAt" TIMESTAMP(3);

CREATE INDEX "Contract_workflowState_idx" ON "Contract"("workflowState");
CREATE INDEX "Contract_contractType_idx" ON "Contract"("contractType");
