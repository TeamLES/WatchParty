import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateHighlightDto {
  @ApiProperty({
    example: 83000,
    minimum: 0,
    description: 'Highlight start timestamp in milliseconds.',
  })
  @IsInt()
  @Min(0)
  startMs!: number;

  @ApiProperty({
    example: 113000,
    minimum: 1,
    description: 'Highlight end timestamp in milliseconds.',
  })
  @IsInt()
  @Min(1)
  endMs!: number;

  @ApiPropertyOptional({
    example: 'Highlight at 1:53',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    example: 'Best reaction of the night.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsNotEmpty()
  @MaxLength(500)
  note?: string;
}
