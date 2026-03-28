import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class JoinRoomDto {
  @ApiPropertyOptional({
    example: 'watchparty123',
    description: 'Required if the room is private',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  password?: string;
}
