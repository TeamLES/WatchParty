import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
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
import { RoomIdParamDto } from './dto/room-id-param.dto';
import {
  type CreateRoomInviteResponse,
  type CreateRoomResponse,
  type GetRoomsResponse,
  type GetRoomMembersResponse,
  type GetRoomResponse,
  type JoinRoomResponse,
  RoomsService,
} from './rooms.service';

@Controller('api/rooms')
@ApiTags('rooms')
@ApiBearerAuth('access-token')
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
    const userId = this.getRequiredUserSub(user);
    return this.roomsService.getRoom(params.roomId, userId);
  }

  @Post(':roomId/join')
  @ApiOperation({ summary: 'Join room as viewer (idempotent)' })
  @ApiParam({ name: 'roomId', type: String })
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
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<JoinRoomResponse> {
    const userId = this.getRequiredUserSub(user);
    return this.roomsService.joinRoom(params.roomId, userId);
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
      throw new UnauthorizedException('Authenticated user is missing sub claim');
    }

    return user.sub;
  }
}
