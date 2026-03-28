import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RoomIdParamDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6a7b8',
    description: 'Server-generated room identifier',
  })
  @IsString()
  @Matches(/^[a-z0-9]{16}$/i, {
    message: 'roomId must be a valid room identifier',
  })
  roomId!: string;
}
