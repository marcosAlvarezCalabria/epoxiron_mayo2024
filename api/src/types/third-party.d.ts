declare module "nodemailer" {
  interface TransportConfig {
    host: string;
    port: number;
    secure: boolean;
    auth?: {
      user: string;
      pass: string;
    };
  }

  interface MailAttachment {
    filename: string;
    content: Buffer;
    contentType?: string;
  }

  interface MailOptions {
    from: string;
    to: string;
    subject: string;
    text: string;
    attachments?: MailAttachment[];
  }

  interface Transporter {
    sendMail(options: MailOptions): Promise<void>;
  }

  const nodemailer: {
    createTransport(config: TransportConfig): Transporter;
  };

  export default nodemailer;
}

declare module "pdfkit" {
  import { Readable } from "node:stream";

  interface PdfDocumentOptions {
    autoFirstPage?: boolean;
    margin?: number;
    size?: string;
  }

  export default class PDFDocument extends Readable {
    public page: {
      height: number;
      width: number;
      margins: {
        bottom: number;
        left: number;
      };
    };
    public x: number;
    public y: number;
    public constructor(options?: PdfDocumentOptions);
    public addPage(): this;
    public end(): void;
    public fillColor(color: string): this;
    public fontSize(size: number): this;
    public lineWidth(width: number): this;
    public moveDown(lines?: number): this;
    public rect(x: number, y: number, width: number, height: number): this;
    public restore(): this;
    public save(): this;
    public stroke(): this;
    public strokeColor(color: string): this;
    public text(
      text: string,
      options?: { continued?: boolean; width?: number }
    ): this;
  }
}
