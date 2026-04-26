import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class KickRoomMemberDto {
  @ApiProperty({
    description: 'User ID of the room member to kick',
    example: 'cognito-user-sub',
  })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty()
  userId!: string;
}
