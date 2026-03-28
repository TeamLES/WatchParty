import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import {
  ROOMS_REPOSITORY,
  normalizeRoomsRepositoryDriver,
} from './constants/rooms-repository.token';
import { RoomsController } from './rooms.controller';
import { DynamoDBRoomsRepository } from './repositories/dynamodb-rooms.repository';
import { InMemoryRoomsRepository } from './repositories/in-memory-rooms.repository';
import type { RoomsRepository } from './repositories/rooms.repository';
import { RoomsService } from './rooms.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [RoomsController],
  providers: [
    RoomsService,
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
          configService.get<string>('AWS_REGION') ?? 'eu-central-1';
        const tableName =
          configService.get<string>('DYNAMODB_ROOMS_TABLE') ?? '(unset)';
        const profile = configService.get<string>('AWS_PROFILE') ?? '(none)';
        const endpoint =
          configService.get<string>('DYNAMODB_ENDPOINT') ?? '(aws-default)';
        const hasStaticCredentials = Boolean(
          configService.get<string>('AWS_ACCESS_KEY_ID') &&
          configService.get<string>('AWS_SECRET_ACCESS_KEY'),
        );

        logger.log(
          [
            `roomsRepositoryDriver=${selectedDriver}`,
            `awsRegion=${region}`,
            `dynamoTable=${tableName}`,
            `awsProfile=${profile}`,
            `dynamoEndpoint=${endpoint}`,
            `hasStaticCredentials=${hasStaticCredentials}`,
          ].join(' '),
        );

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
