export interface DailyReportEmailPayload {
  date: string;
  notesCount: number;
  fileName: string;
  webViewLink: string;
}

export interface IEmailNotifier {
  sendDailyReportNotification(payload: DailyReportEmailPayload): Promise<void>;
}
