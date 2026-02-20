-- Add business ranking and analytics signals on properties.
ALTER TABLE "Property" ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Property" ADD COLUMN "viewsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Property" ADD COLUMN "impressionsCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Property" ADD COLUMN "inquiriesCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "Property_isPremium_idx" ON "Property"("isPremium");
CREATE INDEX "Property_viewsCount_idx" ON "Property"("viewsCount");
CREATE INDEX "Property_inquiriesCount_idx" ON "Property"("inquiriesCount");
