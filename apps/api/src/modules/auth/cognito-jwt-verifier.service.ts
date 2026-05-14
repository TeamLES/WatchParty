import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface VerifiedCognitoAccessToken {
  sub: string;
  token_use: string;
  scope?: string;
  username?: string;
  client_id?: string;
  iss: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

export interface VerifiedCognitoIdToken {
  sub: string;
  token_use: string;
  email?: string;
  email_verified?: boolean;
  username?: string;
  preferred_username?: string;
  iss: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

@Injectable()
export class CognitoJwtVerifierService {
  private readonly accessTokenVerifier: ReturnType<typeof CognitoJwtVerifier.create>;

  private readonly idTokenVerifier: ReturnType<typeof CognitoJwtVerifier.create>;

  private readonly expectedIssuer: string;

  constructor(private readonly configService: ConfigService) {
    const userPoolId = this.getRequiredEnv('COGNITO_USER_POOL_ID');
    const appClientId = this.getRequiredEnv('COGNITO_APP_CLIENT_ID');
    this.expectedIssuer = this.normalizeIssuer(
      this.getRequiredEnv('COGNITO_ISSUER'),
    );

    this.accessTokenVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId: appClientId,
    });

    this.idTokenVerifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId: appClientId,
    });
  }

  async verifyAccessToken(token: string): Promise<VerifiedCognitoAccessToken> {
    try {
      const payload = await this.accessTokenVerifier.verify(token);

      if (this.normalizeIssuer(payload.iss) !== this.expectedIssuer) {
        throw new UnauthorizedException('Token issuer mismatch');
      }

      return payload as VerifiedCognitoAccessToken;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  async verifyIdToken(token: string): Promise<VerifiedCognitoIdToken> {
    try {
      const payload = await this.idTokenVerifier.verify(token);

      if (this.normalizeIssuer(payload.iss) !== this.expectedIssuer) {
        throw new UnauthorizedException('Token issuer mismatch');
      }

      return payload as VerifiedCognitoIdToken;
    } catch {
      throw new UnauthorizedException('Invalid or expired ID token');
    }
  }

  private getRequiredEnv(key: string): string {
    const value = this.configService.get<string>(key);

    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return value;
  }

  private normalizeIssuer(value: string): string {
    return value.replace(/\/+$/g, '');
  }
}
