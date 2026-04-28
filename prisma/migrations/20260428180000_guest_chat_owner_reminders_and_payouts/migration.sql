ALTER TABLE "User"
ADD COLUMN "notifyWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "reminderChannelEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "reminderChannelSms" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "reminderChannelWhatsapp" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "paymentCollectionMode" TEXT NOT NULL DEFAULT 'DIRECT',
ADD COLUMN "paymentMomoNumber" TEXT,
ADD COLUMN "paymentMomoProvider" TEXT,
ADD COLUMN "paymentCardLink" TEXT,
ADD COLUMN "paymentInstructions" TEXT;

ALTER TABLE "MarketplaceInquiry"
ADD COLUMN "lifecycleStage" TEXT NOT NULL DEFAULT 'LEAD',
ADD COLUMN "guestAccessTokenHash" TEXT,
ADD COLUMN "guestAccessTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "guestLastSeenAt" TIMESTAMP(3);

ALTER TABLE "MarketplaceInquiryMessage"
ADD COLUMN "senderGuestName" TEXT,
ADD COLUMN "senderGuestEmail" TEXT;

ALTER TABLE "MarketplaceInquiryMessage"
ALTER COLUMN "senderUserId" DROP NOT NULL;
