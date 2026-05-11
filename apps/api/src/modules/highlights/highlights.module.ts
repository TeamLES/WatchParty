import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { normalizeRoomsRepositoryDriver } from '../rooms/constants/rooms-repository.token';
import { RoomsModule } from '../rooms/rooms.module';
import { HighlightsController } from './highlights.controller';
import { HighlightsService } from './highlights.service';
import { DynamoDBHighlightsRepository } from './repositories/dynamodb-highlights.repository';
import {
  HIGHLIGHTS_REPOSITORY,
  type HighlightsRepository,
} from './repositories/highlights.repository';
import { InMemoryHighlightsRepository } from './repositories/in-memory-highlights.repository';

@Module({
  imports: [ConfigModule, AuthModule, RoomsModule],
  controllers: [HighlightsController],
  providers: [
    HighlightsService,
    InMemoryHighlightsRepository,
    DynamoDBHighlightsRepository,
    {
      provide: HIGHLIGHTS_REPOSITORY,
      inject: [
        ConfigService,
        InMemoryHighlightsRepository,
        DynamoDBHighlightsRepository,
      ],
      useFactory: (
        configService: ConfigService,
        inMemoryRepository: InMemoryHighlightsRepository,
        dynamoRepository: DynamoDBHighlightsRepository,
      ): HighlightsRepository => {
        const logger = new Logger(HighlightsModule.name);
        const selectedDriver = normalizeRoomsRepositoryDriver(
          configService.get<string>('ROOMS_REPOSITORY_DRIVER'),
        );

        logger.log(`highlightsRepositoryDriver=${selectedDriver}`);

        if (selectedDriver === 'dynamodb') {
          return dynamoRepository;
        }

        return inMemoryRepository;
      },
    },
  ],
})
export class HighlightsModule {}
