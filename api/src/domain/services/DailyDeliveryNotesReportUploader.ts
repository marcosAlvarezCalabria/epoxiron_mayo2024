import type { ReportAttachment } from "./DailyDeliveryNotesReportGenerator.js";

export interface DailyDeliveryNotesReportUploadResult {
  fileId: string;
  fileName: string;
  folderName: string;
  webViewLink: string | null;
}

export interface DailyDeliveryNotesReportUploader {
  exists(input: { fileId: string }): Promise<boolean>;
  delete(input: { fileId: string }): Promise<void>;
  upload(input: {
    attachment: ReportAttachment;
    date: Date;
  }): Promise<DailyDeliveryNotesReportUploadResult>;
}
