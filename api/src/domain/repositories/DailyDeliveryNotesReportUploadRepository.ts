import type { DailyDeliveryNotesReportUpload } from "../entities/DailyDeliveryNotesReportUpload.js";

export interface DailyDeliveryNotesReportUploadRepository {
  findByDate(reportDate: Date): Promise<DailyDeliveryNotesReportUpload | null>;
  create(input: {
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
  }): Promise<DailyDeliveryNotesReportUpload>;
  updateByDate(input: {
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
  }): Promise<DailyDeliveryNotesReportUpload>;
}
