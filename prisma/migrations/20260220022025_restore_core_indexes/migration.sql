-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_paymentId_idx" ON "Notification"("paymentId");

-- CreateIndex
CREATE INDEX "SystemLog_createdAt_idx" ON "SystemLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemLog_actorId_idx" ON "SystemLog"("actorId");

-- CreateIndex
CREATE INDEX "SystemLog_targetType_targetId_idx" ON "SystemLog"("targetType", "targetId");
