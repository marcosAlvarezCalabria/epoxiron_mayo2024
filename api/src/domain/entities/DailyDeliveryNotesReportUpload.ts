export interface DailyDeliveryNotesReportUpload {
  id: string;
  reportDate: Date;
  fileId: string;
  fileName: string;
  folderName: string;
  notesCount: number;
  webViewLink: string | null;
  createdAt: Date;
}
