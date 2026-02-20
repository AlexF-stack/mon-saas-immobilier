-- AlterTable
ALTER TABLE "Property" ADD COLUMN "city" TEXT;
ALTER TABLE "MarketplaceInquiry" ADD COLUMN "requesterIp" TEXT;

-- CreateIndex
CREATE INDEX "Property_isPublished_idx" ON "Property"("isPublished");
CREATE INDEX "Property_isPublished_status_idx" ON "Property"("isPublished", "status");
CREATE INDEX "Property_status_idx" ON "Property"("status");
CREATE INDEX "Property_propertyType_idx" ON "Property"("propertyType");
CREATE INDEX "Property_city_idx" ON "Property"("city");
CREATE INDEX "Property_address_idx" ON "Property"("address");
CREATE INDEX "MarketplaceInquiry_requesterIp_createdAt_idx" ON "MarketplaceInquiry"("requesterIp", "createdAt");
