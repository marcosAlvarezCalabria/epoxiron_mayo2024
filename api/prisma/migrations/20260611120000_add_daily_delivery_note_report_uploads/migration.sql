CREATE TABLE "DailyDeliveryNotesReportUpload" (
    "id" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "folderName" TEXT NOT NULL,
    "notesCount" INTEGER NOT NULL,
    "webViewLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyDeliveryNotesReportUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyDeliveryNotesReportUpload_reportDate_key" ON "DailyDeliveryNotesReportUpload"("reportDate");
