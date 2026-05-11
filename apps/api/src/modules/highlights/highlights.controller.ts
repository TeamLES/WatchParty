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
  CreateHighlightResponse,
  GetHighlightsResponse,
  UpdateHighlightResponse,
} from '@watchparty/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CognitoAuthGuard } from '../../common/guards/cognito-auth.guard';
import type { VerifiedCognitoAccessToken } from '../auth/cognito-jwt-verifier.service';
import { RoomIdParamDto } from '../rooms/dto/room-id-param.dto';
import { CreateHighlightDto } from './dto/create-highlight.dto';
import { HighlightIdParamDto } from './dto/highlight-id-param.dto';
import { UpdateHighlightDto } from './dto/update-highlight.dto';
import { HighlightsService } from './highlights.service';

@Controller('api/rooms/:roomId/highlights')
@ApiTags('highlights')
@UseGuards(CognitoAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
export class HighlightsController {
  constructor(private readonly highlightsService: HighlightsService) {}

  @Get()
  @ApiOperation({ summary: 'List room highlights' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiOkResponse({ description: 'Highlights listed' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Only room members can list highlights',
  })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async getHighlights(
    @Param() params: RoomIdParamDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<GetHighlightsResponse> {
    const userId = this.getRequiredUserSub(user);
    return this.highlightsService.getHighlights(params.roomId, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a room highlight' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiBody({ type: CreateHighlightDto })
  @ApiCreatedResponse({ description: 'Highlight created' })
  @ApiBadRequestResponse({ description: 'Invalid highlight payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Only room members can create highlights',
  })
  @ApiNotFoundResponse({ description: 'Room not found' })
  async createHighlight(
    @Param() params: RoomIdParamDto,
    @Body() createHighlightDto: CreateHighlightDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<CreateHighlightResponse> {
    const userId = this.getRequiredUserSub(user);
    return this.highlightsService.createHighlight(
      params.roomId,
      userId,
      createHighlightDto,
    );
  }

  @Delete(':highlightId')
  @ApiOperation({ summary: 'Delete a room highlight' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiParam({ name: 'highlightId', type: String })
  @ApiOkResponse({ description: 'Highlight deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Only creator or room host can delete the highlight',
  })
  @ApiNotFoundResponse({ description: 'Room or highlight not found' })
  async deleteHighlight(
    @Param() params: HighlightIdParamDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<{ message: string }> {
    const userId = this.getRequiredUserSub(user);
    await this.highlightsService.deleteHighlight(
      params.roomId,
      params.highlightId,
      userId,
    );

    return { message: 'Highlight deleted successfully' };
  }

  @Patch(':highlightId')
  @ApiOperation({ summary: 'Update a room highlight title or note' })
  @ApiParam({ name: 'roomId', type: String })
  @ApiParam({ name: 'highlightId', type: String })
  @ApiBody({ type: UpdateHighlightDto })
  @ApiOkResponse({ description: 'Highlight updated' })
  @ApiBadRequestResponse({ description: 'Invalid highlight payload' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  @ApiForbiddenResponse({
    description: 'Only creator can update the highlight',
  })
  @ApiNotFoundResponse({ description: 'Room or highlight not found' })
  async updateHighlight(
    @Param() params: HighlightIdParamDto,
    @Body() updateHighlightDto: UpdateHighlightDto,
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<UpdateHighlightResponse> {
    const userId = this.getRequiredUserSub(user);
    return this.highlightsService.updateHighlight(
      params.roomId,
      params.highlightId,
      userId,
      updateHighlightDto,
    );
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
