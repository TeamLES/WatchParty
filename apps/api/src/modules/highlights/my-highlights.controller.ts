import {
  Controller,
  Get,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type { GetMyHighlightsResponse } from '@watchparty/shared-types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CognitoAuthGuard } from '../../common/guards/cognito-auth.guard';
import type { VerifiedCognitoAccessToken } from '../auth/cognito-jwt-verifier.service';
import { HighlightsService } from './highlights.service';

@Controller('api/me/highlights')
@ApiTags('highlights')
@UseGuards(CognitoAuthGuard)
export class MyHighlightsController {
  constructor(private readonly highlightsService: HighlightsService) {}

  @Get()
  @ApiOperation({ summary: 'List highlights created by current user' })
  @ApiOkResponse({ description: 'Highlights listed' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  async getMyHighlights(
    @CurrentUser() user: VerifiedCognitoAccessToken | null,
  ): Promise<GetMyHighlightsResponse> {
    const userId = this.getRequiredUserSub(user);
    return this.highlightsService.getMyHighlights(userId);
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
