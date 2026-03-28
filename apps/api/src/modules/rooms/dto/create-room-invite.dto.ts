import { IsISO8601, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoomInviteDto {
  @ApiPropertyOptional({
    example: '2026-04-01T00:00:00.000Z',
    nullable: true,
    description: 'Optional invite expiration timestamp (must be in the future)',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'expiresAt must be a valid ISO 8601 date string' })
  expiresAt?: string;
}
