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
      throw new UnauthorizedException('Missing Authorization header');
    }

    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException(
        'Authorization header must use Bearer token',
      );
    }

    request.user = await this.verifierService.verifyAccessToken(token);
    return true;
  }
}