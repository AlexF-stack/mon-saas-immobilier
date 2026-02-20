-- AlterTable
ALTER TABLE "Property" ADD COLUMN "propertyType" TEXT NOT NULL DEFAULT 'APARTMENT';
ALTER TABLE "Property" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "publishedAt" DATETIME;

-- CreateTable
CREATE TABLE "MarketplaceInquiry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "requesterUserId" TEXT,
    "requesterName" TEXT NOT NULL,
    "requesterEmail" TEXT NOT NULL,
    "requesterPhone" TEXT,
    "message" TEXT,
    "preferredVisitDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketplaceInquiry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MarketplaceInquiry_propertyId_createdAt_idx" ON "MarketplaceInquiry"("propertyId", "createdAt");
CREATE INDEX "MarketplaceInquiry_requesterEmail_idx" ON "MarketplaceInquiry"("requesterEmail");
