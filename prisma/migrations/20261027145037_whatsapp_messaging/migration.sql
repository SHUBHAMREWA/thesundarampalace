-- AlterTable
ALTER TABLE "outbox" ADD COLUMN     "campaignId" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMPTZ(3),
ADD COLUMN     "failedAt" TIMESTAMPTZ(3),
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "readAt" TIMESTAMPTZ(3),
ADD COLUMN     "sentAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "message_campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "provider" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateRef" TEXT NOT NULL,
    "templateCategory" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "audience" JSONB NOT NULL,
    "recipientCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_message" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "provider" TEXT NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "message_campaign_createdAt_idx" ON "message_campaign"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_message_providerMessageId_key" ON "inbound_message"("providerMessageId");

-- CreateIndex
CREATE INDEX "inbound_message_receivedAt_idx" ON "inbound_message"("receivedAt");

-- CreateIndex
CREATE INDEX "inbound_message_fromAddress_idx" ON "inbound_message"("fromAddress");

-- CreateIndex
CREATE INDEX "inbound_message_relatedType_relatedId_idx" ON "inbound_message"("relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "outbox_channel_createdAt_idx" ON "outbox"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_campaignId_idx" ON "outbox"("campaignId");

-- CreateIndex
CREATE INDEX "outbox_providerMessageId_idx" ON "outbox"("providerMessageId");

-- AddForeignKey
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "message_campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
