import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Delete,
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

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CognitoAuthGuard } from '../../common/guards/cognito-auth.guard';
import type { VerifiedCognitoAccessToken } from '../auth/cognito-jwt-verifier.service';
import { CreateRoomInviteDto } from './dto/create-room-invite.dto';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { RoomIdParamDto } from './dto/room-id-param.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import type {
  CreateRoomInviteResponse,
  CreateRoomResponse,
  GetRoomsResponse,
  GetRoomMembersResponse,
  GetRoomResponse,
  JoinRoomResponse,
} from '@watchparty/shared-types';
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
  constructor(private readonly roomsService: RoomsService) { }

  @Get()
  @ApiOperation({ summary: 'Get all rooms' })
  @ApiOkResponse({
    description: 'Rooms listed',
    schema: {
      example: [
        {
          roomId: 'a1b2c3d4e5f6a7b8',
          title: 'Friday Night Cinema',
          videoUrl: null,
          isPrivate: true,
          password: 'watchparty123',
          hostUserId: 'cognito-sub',
          memberCount: 1,
          status: 'active',
          createdAt: '2026-03-28T12:00:00.000Z',
        },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async getRooms(): Promise<GetRoomsResponse> {
    return this.roomsService.getRooms();
  }

  @Post()
  @ApiOperation({ summary: 'Create a room and assign current user as host' })
  @ApiBody({ type: CreateRoomDto })
  @ApiCreatedResponse({
    description: 'Room created',
    schema: {
      example: {
        roomId: 'a1b2c3d4e5f6a7b8',
        title: 'Friday Night Cinema',
        videoUrl: null,
        isPrivate: true,
        password: 'watchparty123',
        hostUserId: 'cognito-sub',
        memberCount: 1,
        status: 'active',
        createdAt: '2026-03-28T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid room payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async createRoom(
    @Body() createRoomDto: CreateRoomDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<CreateRoomResponse> {
    const userId = this.getRequiredUserSub(user);
    return this.roomsService.createRoom(userId, createRoomDto);
  }

  @Patch(':roomId')
  @ApiOperation({ summary: 'Update room (host only)' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiBody({ type: UpdateRoomDto })
  @ApiOkResponse({
    description: 'Room updated',
    schema: {
      example: {
        roomId: 'a1b2c3d4e5f6a7b8',
        title: 'Friday Night Cinema Updated',
        videoUrl: 'https://new-url.com',
        isPrivate: true,
        hostUserId: 'cognito-sub',
        memberCount: 1,
        status: 'active',
        createdAt: '2026-03-28T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid payload or roomId' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({ description: 'Only host can update the room' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async updateRoom(
    @Param() params: RoomIdParamDto,
    @Body() updateRoomDto: UpdateRoomDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ) {
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
  @ApiOkResponse({
    description: 'Room found',
    schema: {
      example: {
        roomId: 'a1b2c3d4e5f6a7b8',
        title: 'Friday Night Cinema',
        videoUrl: null,
        isPrivate: true,
        password: 'watchparty123',
        hostUserId: 'cognito-sub',
        memberCount: 2,
        status: 'active',
        createdAt: '2026-03-28T12:00:00.000Z',
        isHost: true,
        isMember: true,
        members: [
          {
            userId: 'cognito-sub',
            role: 'host',
            joinedAt: '2026-03-28T12:00:00.000Z',
          },
        ],
      },
    },
  })
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
  @ApiOkResponse({
    description: 'Joined room or already member',
    schema: {
      example: {
        roomId: 'a1b2c3d4e5f6a7b8',
        userId: 'viewer-sub',
        role: 'viewer',
        joinedAt: '2026-03-28T12:05:00.000Z',
        alreadyMember: false,
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid roomId' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async joinRoom(
    @Param() params: RoomIdParamDto,
    @Body() joinRoomDto: JoinRoomDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<JoinRoomResponse> {
    const userId = user?.sub || `guest-${Math.random().toString(36).substring(7)}`;
    return this.roomsService.joinRoom(params.roomId, userId, joinRoomDto);
  }

  @Post(':roomId/invites')
  @ApiOperation({ summary: 'Create invite code for a room (host only)' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiBody({ type: CreateRoomInviteDto })
  @ApiCreatedResponse({
    description: 'Invite created',
    schema: {
      example: {
        roomId: 'a1b2c3d4e5f6a7b8',
        inviteCode: 'xyz789abc123',
        createdBy: 'host-sub',
        createdAt: '2026-03-28T12:10:00.000Z',
        expiresAt: null,
      },
    },
  })
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
  @ApiOkResponse({
    description: 'Members listed',
    schema: {
      example: {
        roomId: 'a1b2c3d4e5f6a7b8',
        memberCount: 2,
        members: [
          {
            userId: 'host-sub',
            role: 'host',
            joinedAt: '2026-03-28T12:00:00.000Z',
          },
          {
            userId: 'viewer-sub',
            role: 'viewer',
            joinedAt: '2026-03-28T12:05:00.000Z',
          },
        ],
      },
    },
  })
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
}
