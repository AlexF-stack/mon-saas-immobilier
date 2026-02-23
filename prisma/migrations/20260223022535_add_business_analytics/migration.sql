-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SIGNUP', 'CONTRACT_CREATED', 'PAYMENT_COMPLETED', 'WITHDRAW_REQUESTED');

-- CreateTable
CREATE TABLE "BusinessEvent" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "userId" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyKPI" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "signups" INTEGER NOT NULL DEFAULT 0,
    "contracts" INTEGER NOT NULL DEFAULT 0,
    "payments" INTEGER NOT NULL DEFAULT 0,
    "withdrawals" INTEGER NOT NULL DEFAULT 0,
    "grossVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "DailyKPI_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX "BusinessEvent_type_createdAt_idx" ON "BusinessEvent"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DailyKPI_date_key" ON "DailyKPI"("date");


