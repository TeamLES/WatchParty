import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import {
  CognitoJwtVerifierService,
  type VerifiedCognitoAccessToken,
} from '../../modules/auth/cognito-jwt-verifier.service';

export type AuthenticatedRequest = Request & {
  user?: VerifiedCognitoAccessToken;
};

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  constructor(private readonly verifierService: CognitoJwtVerifierService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      // Fallback for demo mode - allow passing through without a token.
      // Decorators in controller should enforce sub when absolutely necessary.
      return true;
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      // Pustime tiez dalej aby mu to nespadlo rovno tu na unauthorized pre public/private request.
      return true;
    }

    try {
      request.user = await this.verifierService.verifyAccessToken(token);
    } catch (err) {
      // Log err but allow through, controllers will throw 401 on getRequiredUserSub if user not populated
      console.warn('Token validation failed, proceeding as unauthenticated guest', err);
    }
    return true;
  }
}