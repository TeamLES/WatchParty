import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import {
  logDynamoDbTables,
  resolveDynamoDbTableNames,
} from '../../common/dynamodb/dynamodb-table-names';
import { AuthModule } from '../auth/auth.module';
import { RealtimePresenceService } from '../realtime/realtime-presence.service';
import {
  normalizeRoomsRepositoryDriver,
  ROOMS_REPOSITORY,
} from './constants/rooms-repository.token';
import { RoomsController } from './rooms.controller';
import { DynamoDBRoomsRepository } from './repositories/dynamodb-rooms.repository';
import { InMemoryRoomsRepository } from './repositories/in-memory-rooms.repository';
import type { RoomsRepository } from './repositories/rooms.repository';
import { RoomsService } from './rooms.service';
import { ScheduledPartyEmailService } from './scheduled-party-email.service';
import { ScheduledPartyReminderWorker } from './scheduled-party-reminder.worker';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [RoomsController],
  providers: [
    RoomsService,
    ScheduledPartyEmailService,
    ScheduledPartyReminderWorker,
    RealtimePresenceService,
    InMemoryRoomsRepository,
    DynamoDBRoomsRepository,
    {
      provide: ROOMS_REPOSITORY,
      inject: [ConfigService, InMemoryRoomsRepository, DynamoDBRoomsRepository],
      useFactory: (
        configService: ConfigService,
        inMemoryRepository: InMemoryRoomsRepository,
        dynamoRepository: DynamoDBRoomsRepository,
      ): RoomsRepository => {
        const logger = new Logger(RoomsModule.name);
        const selectedDriver = normalizeRoomsRepositoryDriver(
          configService.get<string>('ROOMS_REPOSITORY_DRIVER'),
        );
        const region =
          configService.get<string>('AWS_REGION')?.trim() ?? 'eu-central-1';
        const profile = configService.get<string>('AWS_PROFILE') ?? '(none)';
        const endpoint =
          configService.get<string>('DYNAMODB_ENDPOINT') ?? '(aws-default)';
        const hasStaticCredentials = Boolean(
          configService.get<string>('AWS_ACCESS_KEY_ID') &&
          configService.get<string>('AWS_SECRET_ACCESS_KEY'),
        );
        const tableNames = resolveDynamoDbTableNames(configService);

        logger.log(
          [
            `roomsRepositoryDriver=${selectedDriver}`,
            `awsRegion=${region}`,
            `awsProfile=${profile}`,
            `dynamoEndpoint=${endpoint}`,
            `hasStaticCredentials=${hasStaticCredentials}`,
          ].join(' '),
        );
        logDynamoDbTables(logger, tableNames);

        if (selectedDriver === 'dynamodb') {
          return dynamoRepository;
        }

        return inMemoryRepository;
      },
    },
  ],
  exports: [RoomsService, ROOMS_REPOSITORY],
})
export class RoomsModule {}
