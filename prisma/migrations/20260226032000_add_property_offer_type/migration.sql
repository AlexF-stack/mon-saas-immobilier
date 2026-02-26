ALTER TABLE "Property"
ADD COLUMN "offerType" TEXT NOT NULL DEFAULT 'RENT';

CREATE INDEX "Property_offerType_idx" ON "Property"("offerType");

CREATE INDEX "Property_isPublished_status_offerType_idx" ON "Property"("isPublished", "status", "offerType");
