CREATE INDEX "Conversation_buyerId_buyerLastReadAt_idx"
ON "Conversation"("buyerId", "buyerLastReadAt");

CREATE INDEX "Conversation_sellerId_sellerLastReadAt_idx"
ON "Conversation"("sellerId", "sellerLastReadAt");

CREATE INDEX "Message_conversationId_senderId_createdAt_idx"
ON "Message"("conversationId", "senderId", "createdAt");
