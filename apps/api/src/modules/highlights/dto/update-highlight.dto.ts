import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateHighlightDto {
  @ApiPropertyOptional({
    example: 'The big reveal',
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
    example: 'Everyone reacted at exactly the same time.',
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
