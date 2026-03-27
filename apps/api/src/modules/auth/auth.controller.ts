import { Controller, Get, UseGuards } from '@nestjs/common';

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

@Controller('api/auth')
export class AuthController {
  @UseGuards(CognitoAuthGuard)
  @Get('me')
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