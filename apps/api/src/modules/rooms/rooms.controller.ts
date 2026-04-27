import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type {
  CreateRoomInviteResponse,
  CreateRoomResponse,
  GetRoomMembersResponse,
  GetRoomResponse,
  GetRoomsResponse,
  JoinRoomResponse,
} from '@watchparty/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CognitoAuthGuard } from '../../common/guards/cognito-auth.guard';
import type { VerifiedCognitoAccessToken } from '../auth/cognito-jwt-verifier.service';
import { CreateRoomInviteDto } from './dto/create-room-invite.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { KickRoomMemberDto } from './dto/kick-room-member.dto';
import { RoomIdParamDto } from './dto/room-id-param.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RoomsService } from './rooms.service';

@Controller('api/rooms')
@ApiTags('rooms')
@UseGuards(CognitoAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all rooms' })
  @ApiOkResponse({ description: 'Rooms listed' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async getRooms(): Promise<GetRoomsResponse> {
    return this.roomsService.getRooms();
  }

  @Post()
  @ApiOperation({ summary: 'Create a room and assign current user as host' })
  @ApiBody({ type: CreateRoomDto })
  @ApiCreatedResponse({ description: 'Room created' })
  @ApiBadRequestResponse({ description: 'Invalid room payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<CreateRoomResponse> {
    const userId = this.getRequiredUserSub(user);
    return this.roomsService.createRoom(
      userId,
      createRoomDto,
      this.getUserDisplayName(user),
    );
  }

  @Patch(':roomId')
  @ApiOperation({ summary: 'Update room (host only)' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiBody({ type: UpdateRoomDto })
  @ApiOkResponse({ description: 'Room updated' })
  @ApiBadRequestResponse({ description: 'Invalid payload or roomId' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only host can update the room' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async updateRoom(
    @Param() params: RoomIdParamDto,
    @Body() updateRoomDto: UpdateRoomDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<GetRoomResponse> {
    const userId = this.getRequiredUserSub(user);
    return this.roomsService.updateRoom(params.roomId, userId, updateRoomDto);
  }

  @Delete(':roomId')
  @ApiOperation({ summary: 'Delete room (host only)' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiOkResponse({ description: 'Room deleted successfully' })
  @ApiBadRequestResponse({ description: 'Invalid roomId' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only host can delete the room' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async deleteRoom(
    @Param() params: RoomIdParamDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<{ message: string }> {
    const userId = this.getRequiredUserSub(user);
    await this.roomsService.deleteRoom(params.roomId, userId);
    return { message: 'Room deleted successfully' };
  }

  @Get(':roomId')
  @ApiOperation({ summary: 'Get room metadata and members' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiOkResponse({ description: 'Room found' })
  @ApiBadRequestResponse({ description: 'Invalid roomId' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async getRoom(
    @Param() params: RoomIdParamDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<GetRoomResponse> {
    const userId = user?.sub || 'guest';
    return this.roomsService.getRoom(params.roomId, userId);
  }

  @Post(':roomId/join')
  @ApiOperation({ summary: 'Join room as viewer (idempotent)' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiBody({ type: JoinRoomDto, required: false })
  @ApiOkResponse({ description: 'Joined room or already member' })
  @ApiBadRequestResponse({ description: 'Invalid roomId' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async joinRoom(
    @Param() params: RoomIdParamDto,
    @Body() joinRoomDto: JoinRoomDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<JoinRoomResponse> {
    const userId =
      user?.sub || `guest-${Math.random().toString(36).substring(7)}`;
    return this.roomsService.joinRoom(
      params.roomId,
      userId,
      joinRoomDto,
      this.getUserDisplayName(user),
    );
  }

  @Post(':roomId/leave')
  @ApiOperation({ summary: 'Leave room' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiOkResponse({ description: 'Left room successfully' })
  @ApiBadRequestResponse({ description: 'Invalid roomId' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Host cannot leave the room' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async leaveRoom(
    @Param() params: RoomIdParamDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<{ message: string }> {
    const userId = this.getRequiredUserSub(user);
    await this.roomsService.leaveRoom(params.roomId, userId);
    return { message: 'Left room successfully' };
  }

  @Post(':roomId/kick')
  @ApiOperation({ summary: 'Kick a member from room (host only)' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiBody({ type: KickRoomMemberDto })
  @ApiOkResponse({ description: 'Member kicked successfully' })
  @ApiBadRequestResponse({ description: 'Invalid roomId or member payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only host can kick members' })
  @ApiNotFoundResponse({ description: 'Room or member not found' })
  async kickRoomMember(
    @Param() params: RoomIdParamDto,
    @Body() kickRoomMemberDto: KickRoomMemberDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<{ message: string }> {
    const hostUserId = this.getRequiredUserSub(user);
    await this.roomsService.kickMember(
      params.roomId,
      hostUserId,
      kickRoomMemberDto.userId,
    );

    return { message: 'Member kicked successfully' };
  }

  @Post(':roomId/invites')
  @ApiOperation({ summary: 'Create invite code for a room (host only)' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiBody({ type: CreateRoomInviteDto })
  @ApiCreatedResponse({ description: 'Invite created' })
  @ApiBadRequestResponse({ description: 'Invalid payload or roomId' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only host can create invites' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async createInvite(
    @Param() params: RoomIdParamDto,
    @Body() createRoomInviteDto: CreateRoomInviteDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<CreateRoomInviteResponse> {
    const userId = this.getRequiredUserSub(user);
    return this.roomsService.createInvite(
      params.roomId,
      userId,
      createRoomInviteDto,
    );
  }

  @Get(':roomId/members')
  @ApiOperation({ summary: 'List room members' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiOkResponse({ description: 'Members listed' })
  @ApiBadRequestResponse({ description: 'Invalid roomId' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async getRoomMembers(
    @Param() params: RoomIdParamDto,
  ): Promise<GetRoomMembersResponse> {
    return this.roomsService.getRoomMembers(params.roomId);
  }

  private getRequiredUserSub(user: VerifiedCognitoAccessToken | null): string {
    if (!user?.sub) {
      throw new UnauthorizedException(
        'Authenticated user is missing sub claim',
      );
    }

    return user.sub;
  }

  private getUserDisplayName(
    user: VerifiedCognitoAccessToken | null,
  ): string | undefined {
    if (!user) {
      return undefined;
    }

    const candidates = [user.username, user.preferred_username, user.email];

    for (const candidate of candidates) {
      if (typeof candidate !== 'string') {
        continue;
      }

      const trimmed = candidate.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    return undefined;
  }
}
