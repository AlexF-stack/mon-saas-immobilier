ALTER TABLE "User"
ADD COLUMN "rentalTermsTemplate" TEXT;

ALTER TABLE "Contract"
ADD COLUMN "contractNumber" TEXT,
ADD COLUMN "rentalTermsSnapshot" TEXT;

UPDATE "Contract"
SET "contractNumber" = 'CTR-' || TO_CHAR("createdAt", 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5("id"), 1, 10))
WHERE "contractNumber" IS NULL;

ALTER TABLE "Contract"
ALTER COLUMN "contractNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE INDEX "Contract_contractNumber_idx" ON "Contract"("contractNumber");

CREATE TABLE "MarketplaceInquiryMessage" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceInquiryMessage_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MarketplaceInquiryMessage"
ADD CONSTRAINT "MarketplaceInquiryMessage_inquiryId_fkey"
FOREIGN KEY ("inquiryId") REFERENCES "MarketplaceInquiry"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "MarketplaceInquiryMessage"
ADD CONSTRAINT "MarketplaceInquiryMessage_senderUserId_fkey"
FOREIGN KEY ("senderUserId") REFERENCES "User"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

CREATE INDEX "MarketplaceInquiryMessage_inquiryId_createdAt_idx"
ON "MarketplaceInquiryMessage"("inquiryId", "createdAt");

CREATE INDEX "MarketplaceInquiryMessage_senderUserId_createdAt_idx"
ON "MarketplaceInquiryMessage"("senderUserId", "createdAt");
