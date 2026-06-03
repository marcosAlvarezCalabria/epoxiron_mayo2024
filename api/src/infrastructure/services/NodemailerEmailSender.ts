import nodemailer from "nodemailer";
import type { EmailSender } from "../../domain/services/EmailSender.js";

interface NodemailerEmailSenderConfig {
  from: string;
  host: string;
  password: string;
  port: number;
  secure: boolean;
  user: string;
}

export class NodemailerEmailSender implements EmailSender {
  private readonly transporter;

  public constructor(private readonly config: NodemailerEmailSenderConfig) {
    this.transporter = nodemailer.createTransport({
      auth: {
        pass: config.password,
        user: config.user
      },
      host: config.host,
      port: config.port,
      secure: config.secure
    });
  }

  public async send(input: {
    to: string;
    subject: string;
    text: string;
    attachments?: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }>;
  }) {
    await this.transporter.sendMail({
      attachments: input.attachments?.map((attachment) => ({
        content: attachment.content,
        contentType: attachment.contentType,
        filename: attachment.filename
      })),
      from: this.config.from,
      subject: input.subject,
      text: input.text,
      to: input.to
    });
  }
}
