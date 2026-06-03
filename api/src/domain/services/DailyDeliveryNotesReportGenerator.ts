import type { DeliveryNote } from "../entities/DeliveryNote.js";

export interface ReportAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface DailyDeliveryNotesReportGenerator {
  generate(input: { date: Date; notes: DeliveryNote[] }): Promise<ReportAttachment>;
}
