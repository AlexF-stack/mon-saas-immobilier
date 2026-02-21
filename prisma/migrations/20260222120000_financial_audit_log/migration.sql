-- CreateTable
CREATE TABLE "FinancialAuditLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT,
    "correlationId" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialAuditLog_type_entityId_createdAt_idx" ON "FinancialAuditLog"("type", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "FinancialAuditLog_correlationId_idx" ON "FinancialAuditLog"("correlationId");

-- CreateIndex
CREATE INDEX "FinancialAuditLog_actorId_createdAt_idx" ON "FinancialAuditLog"("actorId", "createdAt");
