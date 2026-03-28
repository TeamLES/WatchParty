import { Module } from '@nestjs/common';
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
      inject: [
        ConfigService,
        InMemoryRoomsRepository,
        DynamoDBRoomsRepository,
      ],
      useFactory: (
        configService: ConfigService,
        inMemoryRepository: InMemoryRoomsRepository,
        dynamoRepository: DynamoDBRoomsRepository,
      ): RoomsRepository => {
        const selectedDriver = normalizeRoomsRepositoryDriver(
          configService.get<string>('ROOMS_REPOSITORY_DRIVER'),
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
