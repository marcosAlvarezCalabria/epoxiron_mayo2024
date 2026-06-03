import type { ReportAttachment } from "./DailyDeliveryNotesReportGenerator.js";

export interface EmailSender {
  send(input: {
    to: string;
    subject: string;
    text: string;
    attachments?: ReportAttachment[];
  }): Promise<void>;
}
