CREATE INDEX IF NOT EXISTS "WalletTransaction_userId_createdAt_idx"
ON "WalletTransaction"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Conversation_buyerId_createdAt_idx"
ON "Conversation"("buyerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Conversation_sellerId_createdAt_idx"
ON "Conversation"("sellerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Deal_buyerId_createdAt_idx"
ON "Deal"("buyerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Deal_sellerId_createdAt_idx"
ON "Deal"("sellerId", "createdAt");

CREATE INDEX IF NOT EXISTS "Deal_listingId_buyerId_status_createdAt_idx"
ON "Deal"("listingId", "buyerId", "status", "createdAt");
