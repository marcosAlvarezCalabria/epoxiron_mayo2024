CREATE TABLE "TelegramDeliveryNoteSession" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastUpdateId" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COLLECTING',
    "draft" JSONB NOT NULL,
    "proposal" JSONB,
    "proposalText" TEXT,
    "proposalExpiresAt" TIMESTAMP(3),
    "deliveryNoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramDeliveryNoteSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramDeliveryNoteSession_chatId_userId_key"
ON "TelegramDeliveryNoteSession"("chatId", "userId");
