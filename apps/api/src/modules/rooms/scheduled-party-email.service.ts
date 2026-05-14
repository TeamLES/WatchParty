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
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('SES_REGION')?.trim() ||
      this.configService.get<string>('AWS_REGION')?.trim() ||
      'eu-central-1';
    this.fromEmail =
      this.configService.get<string>('SES_FROM_EMAIL')?.trim() || null;
    this.isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    this.region = region;
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

      this.logger.warn(
        [
          'SES not called: SES_FROM_EMAIL missing; dev fallback only',
          `to=${params.to}`,
          `subject="${subject}"`,
          `roomUrl=${params.roomUrl}`,
        ].join(' '),
      );
      return { delivered: false, provider: 'dev-log' };
    }

    this.logger.log(
      [
        'Sending scheduled reminder via SES',
        `from=${this.fromEmail}`,
        `to=${params.to}`,
        `region=${this.region}`,
        `subject="${subject}"`,
      ].join(' '),
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
        `SES accepted scheduled reminder MessageId=${response.MessageId ?? '(missing)'} to=${params.to}`,
      );
      return {
        delivered: true,
        provider: 'ses',
        messageId: response.MessageId,
      };
    } catch (error) {
      const details = getAwsErrorDetails(error);

      this.logger.error(
        [
          `Failed to send scheduled reminder via SES to=${params.to}`,
          `error.name=${details.name}`,
          `error.message="${details.message}"`,
          `error.$metadata.httpStatusCode=${details.httpStatusCode ?? '(none)'}`,
          `error.$metadata.requestId=${details.requestId ?? '(none)'}`,
          `error.Code=${details.code ?? '(none)'}`,
        ].join(' '),
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}

function getAwsErrorDetails(error: unknown): {
  name: string;
  message: string;
  httpStatusCode?: number;
  requestId?: string;
  code?: string;
} {
  const record =
    typeof error === 'object' && error !== null
      ? (error as Record<string, unknown>)
      : {};
  const metadata =
    typeof record.$metadata === 'object' && record.$metadata !== null
      ? (record.$metadata as Record<string, unknown>)
      : {};
  const code =
    typeof record.Code === 'string'
      ? record.Code
      : typeof record.code === 'string'
        ? record.code
        : undefined;

  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error),
    ...(typeof metadata.httpStatusCode === 'number'
      ? { httpStatusCode: metadata.httpStatusCode }
      : {}),
    ...(typeof metadata.requestId === 'string'
      ? { requestId: metadata.requestId }
      : {}),
    ...(code ? { code } : {}),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
