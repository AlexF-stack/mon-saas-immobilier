-- AlterTable
ALTER TABLE "DailyKPI"
RENAME COLUMN "withdrawals" TO "withdrawalCount";

-- AlterTable
ALTER TABLE "DailyKPI"
RENAME COLUMN "netRevenue" TO "netCashFlow";

-- AlterTable
ALTER TABLE "DailyKPI"
ADD COLUMN "withdrawalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Data backfill for semantic alignment with cash-flow model.
UPDATE "DailyKPI"
SET "netCashFlow" = "grossVolume" - "withdrawalVolume";
