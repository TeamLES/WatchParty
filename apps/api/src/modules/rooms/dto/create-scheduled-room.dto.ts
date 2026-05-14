import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduledRoomDto {
  @ApiProperty({ example: 'Movie night', maxLength: 120 })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ example: 'Optional', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  )
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim().length > 0
      ? value.trim()
      : undefined,
  )
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  videoUrl?: string;

  @ApiProperty({ example: '2026-05-20T18:00:00.000Z' })
  @IsISO8601()
  scheduledStartAt!: string;

  @ApiPropertyOptional({ example: 30, default: 30, minimum: 1, maximum: 1440 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(1440)
  reminderMinutesBefore?: number;

  @ApiPropertyOptional({ example: 'private', enum: ['public', 'private'] })
  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({ example: 'Europe/Bratislava' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  scheduledTimezone?: string;
}
