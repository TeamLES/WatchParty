import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ROOMS_REPOSITORY } from './constants/rooms-repository.token';
import type { RoomMember } from './entities/room-member.entity';
import type { Room } from './entities/room.entity';
import {
  ReminderClaimConflictError,
  type RoomsRepository,
} from './repositories/rooms.repository';
import { ScheduledPartyEmailService } from './scheduled-party-email.service';

const DEFAULT_INTERVAL_MS = 60_000;
const CLAIM_STALE_AFTER_MS = 10 * 60_000;

@Injectable()
export class ScheduledPartyReminderWorker
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ScheduledPartyReminderWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    @Inject(ROOMS_REPOSITORY)
    private readonly roomsRepository: RoomsRepository,
    private readonly emailService: ScheduledPartyEmailService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled =
      this.configService.get<string>('SCHEDULE_REMINDER_POLL_ENABLED') !==
      'false';

    if (!enabled) {
      this.logger.log('scheduled reminder worker started enabled=false');
      return;
    }

    const intervalMs = Math.max(
      Number(
        this.configService.get<string>('SCHEDULE_REMINDER_INTERVAL_MS') ??
          DEFAULT_INTERVAL_MS,
      ),
      5_000,
    );

    this.timer = setInterval(() => void this.runOnce(), intervalMs);
    void this.runOnce();
    this.logger.log(
      `scheduled reminder worker started enabled=true intervalMs=${intervalMs}`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    try {
      const nowIso = new Date().toISOString();
      const dueRooms =
        await this.roomsRepository.listDueScheduledReminderRooms(nowIso);
      this.logger.log(`scheduled reminder dueRooms=${dueRooms.length}`);

      for (const room of dueRooms) {
        await this.processRoom(room);
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async processRoom(room: Room): Promise<void> {
    this.logger.log(`processing scheduled reminder roomId=${room.roomId}`);
    const now = new Date();
    const nowIso = now.toISOString();
    const staleBeforeIso = new Date(
      now.getTime() - CLAIM_STALE_AFTER_MS,
    ).toISOString();

    let claimedRoom: Room;

    try {
      claimedRoom = await this.roomsRepository.claimScheduledReminder(
        room.roomId,
        nowIso,
        staleBeforeIso,
      );
    } catch (error) {
      if (error instanceof ReminderClaimConflictError) {
        return;
      }

      throw error;
    }

    try {
      const members = await this.roomsRepository.getMembersByRoomId(
        claimedRoom.roomId,
      );
      const goingMembers = members.filter(
        (member) => member.rsvpStatus === 'going',
      );
      const host = members.find(
        (member) => member.userId === claimedRoom.hostUserId,
      );
      this.logger.log(
        `scheduled reminder roomId=${claimedRoom.roomId} goingMembers=${goingMembers.length}`,
      );

      const results = await Promise.all(
        goingMembers.map((member) =>
          this.sendMemberReminder(claimedRoom, member, host),
        ),
      );

      const hasFailures = results.some((status) => status === 'failed');
      const hasSkipped = results.some((status) => status === 'skipped');
      const failedCount = results.filter(
        (status) => status === 'failed',
      ).length;
      const skippedCount = results.filter(
        (status) => status === 'skipped',
      ).length;
      const sentCount = results.filter((status) => status === 'sent').length;

      this.logger.log(
        [
          `scheduled reminder summary roomId=${claimedRoom.roomId}`,
          `sent=${sentCount}`,
          `skipped=${skippedCount}`,
          `failed=${failedCount}`,
        ].join(' '),
      );

      if (hasFailures || hasSkipped) {
        await this.roomsRepository.updateRoom({
          ...claimedRoom,
          reminderStatus: 'failed',
          reminderError: [
            failedCount ? `${failedCount} member email(s) failed` : null,
            skippedCount ? `${skippedCount} member email(s) skipped` : null,
          ]
            .filter(Boolean)
            .join('; '),
        });
      } else {
        await this.roomsRepository.updateRoom({
          ...claimedRoom,
          reminderStatus: 'sent',
          reminderSentAt: new Date().toISOString(),
          reminderError: undefined,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.roomsRepository.updateRoom({
        ...claimedRoom,
        reminderStatus: 'failed',
        reminderError: message.slice(0, 1000),
      });
    }
  }

  private async sendMemberReminder(
    room: Room,
    member: RoomMember,
    host?: RoomMember,
  ): Promise<'sent' | 'skipped' | 'failed'> {
    if (member.reminderEmailSentAt || member.reminderEmailStatus === 'sent') {
      this.logger.log(
        `skipping scheduled reminder roomId=${room.roomId} userId=${member.userId} email=${member.email ?? '(missing)'} reason=already-sent`,
      );
      return 'sent';
    }

    if (!member.email) {
      this.logger.warn(
        `skipping scheduled reminder roomId=${room.roomId} userId=${member.userId} email=(missing) reason=missing-email`,
      );
      await this.roomsRepository.updateMember({
        ...member,
        reminderEmailStatus: 'failed',
        reminderEmailError: 'Member has no email address',
      });
      return 'failed';
    }

    try {
      const result = await this.emailService.sendScheduledPartyReminderEmail({
        to: member.email,
        displayName: member.nickname,
        partyTitle: room.scheduledTitle ?? room.title,
        scheduledStartAt:
          room.scheduledStartAt ?? room.reminderAt ?? room.createdAt,
        roomUrl: room.appRoomUrl ?? this.buildRoomUrl(room.roomId),
        hostName: host?.nickname,
      });

      if (result.provider === 'dev-log' && !result.delivered) {
        this.logger.warn(
          `skipping scheduled reminder roomId=${room.roomId} userId=${member.userId} email=${member.email} reason=dev-log-provider`,
        );
        await this.roomsRepository.updateMember({
          ...member,
          reminderEmailStatus: 'skipped',
          reminderEmailError:
            'Email was not sent because SES_FROM_EMAIL is not configured and provider=dev-log',
        });
        return 'skipped';
      }

      await this.roomsRepository.updateMember({
        ...member,
        reminderEmailSentAt: new Date().toISOString(),
        reminderEmailStatus: 'sent',
        reminderEmailError: undefined,
        ...(result.messageId
          ? { reminderEmailMessageId: result.messageId }
          : {}),
      });
      return 'sent';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `scheduled reminder failed roomId=${room.roomId} userId=${member.userId} to=${member.email}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      await this.roomsRepository.updateMember({
        ...member,
        reminderEmailStatus: 'failed',
        reminderEmailError: message.slice(0, 1000),
      });
      return 'failed';
    }
  }

  private buildRoomUrl(roomId: string): string {
    const rawBaseUrl = this.configService.get<string>('APP_BASE_URL')?.trim();
    let baseUrl = rawBaseUrl?.replace(/\/+$/g, '') ?? 'http://localhost:3000';

    if (baseUrl.endsWith('/hub')) {
      baseUrl = baseUrl.slice(0, -4);
    }

    if (
      this.configService.get<string>('NODE_ENV') === 'production' &&
      baseUrl.includes('localhost')
    ) {
      this.logger.warn(
        `APP_BASE_URL contains localhost in production: ${baseUrl}`,
      );
    }

    return `${baseUrl}/room/${roomId}`;
  }
}
