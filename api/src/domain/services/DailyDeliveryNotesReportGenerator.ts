import type { DeliveryNote } from "../entities/DeliveryNote.js";

export interface ReportAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface DeliveryNoteReportCustomerDetails {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface DailyDeliveryNotesReportGenerator {
  generate(input: {
    date: Date;
    notes: DeliveryNote[];
    customersById: Record<string, DeliveryNoteReportCustomerDetails>;
  }): Promise<ReportAttachment>;
}
