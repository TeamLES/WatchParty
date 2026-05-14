import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RsvpRoomDto {
  @ApiProperty({ example: 'going', enum: ['going', 'not_going', 'maybe'] })
  @IsIn(['going', 'not_going', 'maybe'])
  status!: 'going' | 'not_going' | 'maybe';
}
