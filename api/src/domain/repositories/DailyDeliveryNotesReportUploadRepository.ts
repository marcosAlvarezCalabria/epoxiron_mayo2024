import type { DailyDeliveryNotesReportUpload } from "../entities/DailyDeliveryNotesReportUpload.js";

export interface DailyDeliveryNotesReportUploadRepository {
  findByDate(reportDate: Date): Promise<DailyDeliveryNotesReportUpload | null>;
  findAll(filters: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<DailyDeliveryNotesReportUpload[]>;
  count(filters: {
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<number>;
  create(input: {
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    lastSourceUpdatedAt: Date;
  }): Promise<DailyDeliveryNotesReportUpload>;
  updateByDate(input: {
    reportDate: Date;
    fileId: string;
    fileName: string;
    folderName: string;
    notesCount: number;
    webViewLink: string | null;
    lastSourceUpdatedAt: Date;
  }): Promise<DailyDeliveryNotesReportUpload>;
  deleteByDate(reportDate: Date): Promise<void>;
}
