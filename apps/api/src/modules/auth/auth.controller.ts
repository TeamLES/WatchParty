import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CognitoAuthGuard } from '../../common/guards/cognito-auth.guard';
import type { VerifiedCognitoAccessToken } from './cognito-jwt-verifier.service';

export interface AuthMeResponse {
  sub: string;
  username?: string;
  scope?: string;
  clientId?: string;
  tokenUse: string;
  issuedAt: number;
  expiresAt: number;
}

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  @UseGuards(CognitoAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Return claims from the authenticated Cognito access token' })
  @ApiOkResponse({
    description: 'Authenticated token claims',
    schema: {
      example: {
        sub: 'cognito-sub',
        username: 'matej',
        scope: 'openid profile',
        clientId: '5mpa4t4udufhp5687jaa5ari5u',
        tokenUse: 'access',
        issuedAt: 1711630000,
        expiresAt: 1711633600,
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid bearer token' })
  getMe(@CurrentUser() user: VerifiedCognitoAccessToken): AuthMeResponse {
    return {
      sub: user.sub,
      username: typeof user.username === 'string' ? user.username : undefined,
      scope: typeof user.scope === 'string' ? user.scope : undefined,
      clientId: typeof user.client_id === 'string' ? user.client_id : undefined,
      tokenUse: user.token_use,
      issuedAt: user.iat,
      expiresAt: user.exp,
    };
  }
}