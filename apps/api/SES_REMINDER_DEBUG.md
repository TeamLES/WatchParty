# WatchParty SES reminder debugging

The local API loads environment variables through Nest `ConfigModule` from:

1. `apps/api/.env.local`
2. `.env.local`
3. `apps/api/.env`
4. `.env`

This order works both when the API is started from the repository root and when the working directory is `apps/api`.

## Local profile-based run

Use the same AWS profile that works with `aws ses send-email`.

Linux/macOS:

```bash
AWS_PROFILE=miroslavhanisko AWS_REGION=eu-central-1 npm run start:dev
```

Windows PowerShell:

```powershell
$env:AWS_PROFILE="miroslavhanisko"
$env:AWS_REGION="eu-central-1"
npm run start:dev
```

With pnpm from the repository root:

```powershell
$env:AWS_PROFILE="miroslavhanisko"
$env:AWS_REGION="eu-central-1"
pnpm --dir apps/api start:dev
```

Do not set empty static AWS credential variables locally. Prefer commenting out:

```dotenv
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_SESSION_TOKEN=
```

## Manual app-level SES test

```powershell
$env:TEST_EMAIL_TO="haniskomiroslav@gmail.com"
pnpm --dir apps/api test:ses
```

Expected success output:

```text
SES accepted test email MessageId=...
```

## Expected reminder logs

When the app really calls SES:

```text
Sending scheduled reminder via SES from=... to=... region=eu-central-1 subject="..."
SES accepted scheduled reminder MessageId=... to=...
```

When the app does not call SES because it fell back to dev logging:

```text
SES not called: SES_FROM_EMAIL missing; dev fallback only ...
skipping scheduled reminder ... reason=dev-log-provider
```

## Retesting old rooms

The worker skips members that already have `reminderEmailStatus=sent` or `reminderEmailSentAt`.
For a clean reminder test, create a new scheduled room or reset these fields:

- `rooms.reminderStatus`
- `rooms.reminderSentAt`
- `room-members.reminderEmailStatus`
- `room-members.reminderEmailSentAt`
- `room-members.reminderEmailMessageId`

After a successful app-level send, `room-members.reminderEmailMessageId` should be present.
