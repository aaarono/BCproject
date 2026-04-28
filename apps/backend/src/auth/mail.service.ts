import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  private get isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  private get smtpConfigured() {
    return !!process.env.SMTP_HOST;
  }

  private getTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    const secure = process.env.SMTP_SECURE === 'true';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host) {
      if (this.isProduction) {
        throw new InternalServerErrorException(
          'SMTP is not configured on server',
        );
      }
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
  }

  async sendEmail(params: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }) {
    const from =
      process.env.SMTP_FROM ?? 'TradeGame <no-reply@tradegame.local>';

    if (!this.smtpConfigured && !this.isProduction) {
      this.logger.warn(
        `SMTP is not configured. Email delivery skipped in development mode for ${params.to}.`,
      );
      this.logger.log(`[DEV MAIL] Subject: ${params.subject}`);
      this.logger.log(`[DEV MAIL] Body: ${params.text}`);
      return;
    }

    const transporter = this.getTransporter();
    if (!transporter) {
      throw new InternalServerErrorException(
        'Unable to initialize mail transport',
      );
    }

    await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
  }
}
