import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
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
  constructor(private readonly verifierService: CognitoJwtVerifierService) {}

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
      const accessTokenPayload =
        await this.verifierService.verifyAccessToken(token);
      request.user = await this.mergeIdTokenClaims(
        accessTokenPayload,
        request.headers['x-watchparty-id-token'],
      );
    } catch (err) {
      // Log err but allow through, controllers will throw 401 on getRequiredUserSub if user not populated
      console.warn(
        'Token validation failed, proceeding as unauthenticated guest',
        err,
      );
    }
    return true;
  }

  private async mergeIdTokenClaims(
    accessTokenPayload: VerifiedCognitoAccessToken,
    idTokenHeader: string | string[] | undefined,
  ): Promise<VerifiedCognitoAccessToken> {
    const idToken = Array.isArray(idTokenHeader)
      ? idTokenHeader[0]
      : idTokenHeader;

    if (!idToken) {
      return accessTokenPayload;
    }

    try {
      const idTokenPayload = await this.verifierService.verifyIdToken(idToken);

      if (idTokenPayload.sub !== accessTokenPayload.sub) {
        console.warn('ID token subject mismatch, ignoring ID token claims');
        return accessTokenPayload;
      }

      return {
        ...accessTokenPayload,
        ...(typeof idTokenPayload.email === 'string'
          ? { email: idTokenPayload.email }
          : {}),
        ...(typeof idTokenPayload.email_verified === 'boolean'
          ? { email_verified: idTokenPayload.email_verified }
          : {}),
        ...(typeof idTokenPayload.preferred_username === 'string'
          ? { preferred_username: idTokenPayload.preferred_username }
          : {}),
        ...(typeof idTokenPayload.username === 'string'
          ? { username: idTokenPayload.username }
          : {}),
      };
    } catch (err) {
      console.warn('ID token validation failed, ignoring ID token claims', err);
      return accessTokenPayload;
    }
  }
}
