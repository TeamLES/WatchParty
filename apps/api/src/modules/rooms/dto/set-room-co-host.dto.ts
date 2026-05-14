import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SetRoomCoHostDto {
  @ApiPropertyOptional({
    description:
      'User ID of the room member to promote. Omit or pass null to pick a random eligible viewer.',
    example: 'cognito-user-sub',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  userId?: string | null;
}
