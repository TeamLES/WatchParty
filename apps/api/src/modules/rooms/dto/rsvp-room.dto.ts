import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RsvpRoomDto {
  @ApiProperty({ example: 'going', enum: ['going', 'not_going'] })
  @IsIn(['going', 'not_going'])
  status!: 'going' | 'not_going';
}
