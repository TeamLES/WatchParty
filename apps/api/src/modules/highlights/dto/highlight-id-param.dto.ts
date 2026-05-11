import { IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class HighlightIdParamDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6a7b8',
    description: 'Server-generated room identifier',
  })
  @IsString()
  @Matches(/^[a-z0-9]{16}$/i, {
    message: 'roomId must be a valid room identifier',
  })
  roomId!: string;

  @ApiProperty({
    example: '1d88e2b8-a198-41cb-9f6f-2dc2892042b2',
    description: 'Server-generated highlight UUID',
  })
  @IsUUID()
  highlightId!: string;
}
