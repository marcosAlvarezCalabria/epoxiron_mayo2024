import nodemailer from "nodemailer";
import type {
  DailyReportEmailPayload,
  IEmailNotifier
} from "../../domain/ports/IEmailNotifier.js";

interface NodemailerEmailNotifierConfig {
  enabled: boolean;
  from: string;
  to: string;
  appPassword: string;
}

export class NodemailerEmailNotifier implements IEmailNotifier {
  private readonly transporter;

  public constructor(private readonly config: NodemailerEmailNotifierConfig) {
    this.transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: config.appPassword
      }
    });
  }

  public async sendDailyReportNotification(payload: DailyReportEmailPayload): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await this.transporter.sendMail({
      from: this.config.from,
      to: this.config.to,
      subject: `Reporte diario Epoxiron - ${payload.date}`,
      text:
        "Se ha generado y subido correctamente el reporte diario.\n\n" +
        `Fecha: ${payload.date}\n` +
        `Albaranes incluidos: ${payload.notesCount}\n` +
        `Archivo: ${payload.fileName}\n\n` +
        `Ver archivo: ${payload.webViewLink}\n\n` +
        "Epoxi, sistema automatico de Epoxiron"
    });

    console.log(
      `[EmailNotifier] reporte diario enviado a ${this.config.to} para ${payload.date}`
    );
  }
}
