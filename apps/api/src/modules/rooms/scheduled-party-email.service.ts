import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendScheduledPartyReminderEmailParams {
  to: string;
  displayName?: string;
  partyTitle: string;
  scheduledStartAt: string;
  roomUrl: string;
  hostName?: string;
}

@Injectable()
export class ScheduledPartyEmailService {
  private readonly logger = new Logger(ScheduledPartyEmailService.name);
  private readonly sesClient: SESClient;
  private readonly fromEmail: string | null;
  private readonly isProduction: boolean;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('SES_REGION')?.trim() ||
      this.configService.get<string>('AWS_REGION')?.trim() ||
      'eu-central-1';
    this.fromEmail =
      this.configService.get<string>('SES_FROM_EMAIL')?.trim() || null;
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    this.sesClient = new SESClient({ region });

    this.logger.log(
      `Initializing ScheduledPartyEmailService: isProduction=${this.isProduction}, region=${region}, hasFromEmail=${!!this.fromEmail}`,
    );

    if (!this.fromEmail) {
      this.logger.warn(
        'SES_FROM_EMAIL is not set. Scheduled reminder emails will be logged instead of sent outside production.',
      );
    }
  }

  async sendScheduledPartyReminderEmail(
    params: SendScheduledPartyReminderEmailParams,
  ): Promise<{
    delivered: boolean;
    provider: 'ses' | 'dev-log';
    messageId?: string;
  }> {
    const subject = `WatchParty reminder: ${params.partyTitle} starts soon`;
    const startLabel = new Date(params.scheduledStartAt).toLocaleString('en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const greeting = params.displayName ? `Hi ${params.displayName},` : 'Hi,';
    const hostLine = params.hostName ? `\nHost: ${params.hostName}` : '';
    const textBody = [
      greeting,
      '',
      `Your WatchParty "${params.partyTitle}" starts soon.`,
      `Start time: ${startLabel}${hostLine}`,
      `Room link: ${params.roomUrl}`,
      '',
      "You RSVP'd as going.",
    ].join('\n');
    const htmlBody = [
      `<p>${escapeHtml(greeting)}</p>`,
      `<p>Your WatchParty <strong>${escapeHtml(params.partyTitle)}</strong> starts soon.</p>`,
      `<p><strong>Start time:</strong> ${escapeHtml(startLabel)}</p>`,
      params.hostName
        ? `<p><strong>Host:</strong> ${escapeHtml(params.hostName)}</p>`
        : '',
      `<p><a href="${escapeHtml(params.roomUrl)}">Open the room</a></p>`,
      "<p>You RSVP'd as going.</p>",
    ].join('');

    if (!this.fromEmail) {
      if (this.isProduction) {
        throw new Error('SES_FROM_EMAIL is required in production');
      }

      this.logger.log(
        `[dev-log] Dev email reminder to=${params.to} subject="${subject}" roomUrl=${params.roomUrl}`,
      );
      return { delivered: false, provider: 'dev-log' };
    }

    this.logger.log(
      `Sending SES reminder to=${params.to} subject="${subject}" source=${this.fromEmail}`,
    );

    try {
      const response = await this.sesClient.send(
        new SendEmailCommand({
          Source: this.fromEmail,
          Destination: {
            ToAddresses: [params.to],
          },
          Message: {
            Subject: {
              Data: subject,
              Charset: 'UTF-8',
            },
            Body: {
              Text: {
                Data: textBody,
                Charset: 'UTF-8',
              },
              Html: {
                Data: htmlBody,
                Charset: 'UTF-8',
              },
            },
          },
        }),
      );

      this.logger.log(
        `SES reminder sent to=${params.to} messageId=${response.MessageId}`,
      );
      return {
        delivered: true,
        provider: 'ses',
        messageId: response.MessageId,
      };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const awsRequestId = (
        (error as Record<string, unknown>)?.$metadata as Record<string, unknown>
      )?.requestId as string | undefined;

      this.logger.error(
        `Failed to send SES reminder to=${params.to}: [${errorName}] ${errorMessage} (RequestId: ${awsRequestId || 'N/A'})`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
