import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
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

export class CreateRoomDto {
  @ApiProperty({
    example: 'Friday Night Cinema',
    maxLength: 120,
  })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  })
  @IsNotEmpty()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true })
  videoUrl?: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: 'Set true to create a private room.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') {
      return true;
    }

    if (value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  isPrivate?: boolean;

  @ApiPropertyOptional({
    example: 'watchparty123',
    maxLength: 120,
    description: 'Required when isPrivate is true.',
  })
  @ValidateIf(
    (dto: CreateRoomDto) =>
      dto.isPrivate === true || dto.password !== undefined,
  )
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @MaxLength(120)
  password?: string;

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
}
