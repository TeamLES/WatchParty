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
  ValidateIf,
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

  @ApiPropertyOptional({
    example: 12,
    minimum: 2,
    maximum: 500,
    description: 'Optional hard room capacity. Omit for an unlimited room.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      return trimmedValue.length > 0 ? Number(trimmedValue) : undefined;
    }

    return value;
  })
  @IsInt()
  @Min(2)
  @Max(500)
  maxCapacity?: number;

  @ApiPropertyOptional({ example: 'private', enum: ['public', 'private'] })
  @IsOptional()
  @IsIn(['public', 'private'])
  visibility?: 'public' | 'private';

  @ApiPropertyOptional({
    example: 'watchparty123',
    maxLength: 120,
    description: 'Required when visibility is private.',
  })
  @ValidateIf(
    (dto: CreateScheduledRoomDto) =>
      dto.visibility === 'private' || dto.password !== undefined,
  )
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(120)
  password?: string;

  @ApiPropertyOptional({ example: 'Europe/Bratislava' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  scheduledTimezone?: string;
}
