import { ConfigService } from '@nestjs/config';
import { ScheduledPartyEmailService } from './src/modules/rooms/scheduled-party-email.service';

/**
 * Run this script to test SES email sending manually in a safe way.
 * 
 * Usage from apps/api: 
 * npx tsx test-ses.ts <recipient@example.com>
 * 
 * Note: Assumes `.env` or appropriate environment variables are loaded.
 */
async function main() {
  const recipient = process.argv[2];
  if (!recipient || !recipient.includes('@')) {
    console.error('Usage: npx tsx test-ses.ts <recipient@example.com>');
    process.exit(1);
  }

  // A dummy config service just to load ENV vars for test
  const configService = {
    get: (key: string) => process.env[key],
  } as ConfigService;

  const emailService = new ScheduledPartyEmailService(configService);

  try {
    console.log(`Sending test email to ${recipient}...`);
    const result = await emailService.sendScheduledPartyReminderEmail({
      to: recipient,
      displayName: 'Test User',
      partyTitle: 'SES Manual Test Party',
      scheduledStartAt: new Date().toISOString(),
      roomUrl: 'http://localhost:3000/room/test-123',
      hostName: 'Admin',
    });
    console.log('Result:', result);
  } catch (error) {
    console.error('Failed to send test email', error);
  }
}

main().catch(console.error);
