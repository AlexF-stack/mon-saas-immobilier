-- Property land documents (titres fonciers, plans, etc.)
CREATE TABLE "PropertyDocument" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT 'OTHER',
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PropertyDocument_propertyId_createdAt_idx" ON "PropertyDocument"("propertyId", "createdAt");

ALTER TABLE "PropertyDocument" ADD CONSTRAINT "PropertyDocument_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Visit scheduling on marketplace inquiries
ALTER TABLE "MarketplaceInquiry" ADD COLUMN "scheduledVisitAt" TIMESTAMP(3);
ALTER TABLE "MarketplaceInquiry" ADD COLUMN "visitStatus" TEXT NOT NULL DEFAULT 'REQUESTED';
ALTER TABLE "MarketplaceInquiry" ADD COLUMN "visitNotes" TEXT;
ALTER TABLE "MarketplaceInquiry" ADD COLUMN "visitReminderSentAt" TIMESTAMP(3);

CREATE INDEX "MarketplaceInquiry_scheduledVisitAt_visitStatus_idx" ON "MarketplaceInquiry"("scheduledVisitAt", "visitStatus");
