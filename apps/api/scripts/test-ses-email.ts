import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type AwsErrorDetails = {
  name: string;
  message: string;
  httpStatusCode?: number;
  requestId?: string;
  code?: string;
};

const envFiles = [
  'apps/api/.env.local',
  '.env.local',
  'apps/api/.env',
  '.env',
  '.env.local',
  '.env',
];

function loadEnvFiles(): void {
  for (const relativePath of envFiles) {
    const filePath = resolve(process.cwd(), relativePath);

    if (!existsSync(filePath)) {
      continue;
    }

    const content = readFileSync(filePath, 'utf8');

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();

      if (process.env[key] !== undefined) {
        continue;
      }

      process.env[key] = stripQuotes(rawValue);
    }
  }
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function getAwsErrorDetails(error: unknown): AwsErrorDetails {
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

async function main(): Promise<void> {
  loadEnvFiles();

  const to = process.env.TEST_EMAIL_TO ?? process.argv[2];
  const from = process.env.SES_FROM_EMAIL?.trim();
  const region =
    process.env.SES_REGION?.trim() ||
    process.env.AWS_REGION?.trim() ||
    'eu-central-1';

  if (!to || !to.includes('@')) {
    throw new Error(
      'Recipient is required. Set TEST_EMAIL_TO=<verified-recipient> or pass it as the first argument.',
    );
  }

  if (!from) {
    throw new Error('SES_FROM_EMAIL is required.');
  }

  console.log(
    [
      'Sending WatchParty SES test',
      `from=${from}`,
      `to=${to}`,
      `region=${region}`,
      `awsProfile=${process.env.AWS_PROFILE ?? '(default)'}`,
    ].join(' '),
  );

  const sesClient = new SESClient({ region });
  const response = await sesClient.send(
    new SendEmailCommand({
      Source: from,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: 'WatchParty SES test',
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: 'Test from WatchParty SES manual script.',
            Charset: 'UTF-8',
          },
        },
      },
    }),
  );

  console.log(`SES accepted test email MessageId=${response.MessageId}`);
}

main().catch((error: unknown) => {
  const details = getAwsErrorDetails(error);
  console.error(
    [
      'SES test failed',
      `error.name=${details.name}`,
      `error.message="${details.message}"`,
      `error.$metadata.httpStatusCode=${details.httpStatusCode ?? '(none)'}`,
      `error.$metadata.requestId=${details.requestId ?? '(none)'}`,
      `error.Code=${details.code ?? '(none)'}`,
    ].join(' '),
  );
  process.exitCode = 1;
});
