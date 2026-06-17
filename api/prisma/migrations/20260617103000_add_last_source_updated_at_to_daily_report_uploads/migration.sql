ALTER TABLE "DailyDeliveryNotesReportUpload"
ADD COLUMN "lastSourceUpdatedAt" TIMESTAMP(3);

UPDATE "DailyDeliveryNotesReportUpload"
SET "lastSourceUpdatedAt" = "createdAt"
WHERE "lastSourceUpdatedAt" IS NULL;

ALTER TABLE "DailyDeliveryNotesReportUpload"
ALTER COLUMN "lastSourceUpdatedAt" SET NOT NULL;
