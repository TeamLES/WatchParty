import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({
    example: 'Friday Night Cinema',
    maxLength: 120,
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({
    example: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    maxLength: 2048,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
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
  @Transform(({ value }) => {
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
    (dto: CreateRoomDto) => dto.isPrivate === true || dto.password !== undefined,
  )
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  @MaxLength(120)
  password?: string;
}
