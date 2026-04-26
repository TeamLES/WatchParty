import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

function normalizeHostedUiDomain(domain: string): string {
  const trimmedDomain = domain.trim().replace(/\/+$/, '');

  if (
    trimmedDomain.startsWith('https://') ||
    trimmedDomain.startsWith('http://')
  ) {
    return trimmedDomain;
  }

  return `https://${trimmedDomain}`;
}

function parseSwaggerScopes(rawScopes: string | undefined): string[] {
  const defaultScopes = ['openid', 'profile', 'email'];

  if (!rawScopes) {
    return defaultScopes;
  }

  const scopes = rawScopes
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);

  return scopes.length > 0 ? scopes : defaultScopes;
}

function resolveSwaggerOauth2RedirectUrl(
  appPort: string,
  docsPath: string,
  explicitRedirectUrl?: string,
): string {
  const normalizedExplicit = explicitRedirectUrl?.trim();

  if (normalizedExplicit) {
    return normalizedExplicit;
  }

  return `http://localhost:${appPort}/${docsPath}/oauth2-redirect.html`;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const appPort = configService.get<string>('PORT') ?? '3001';
  const swaggerDocsPath = 'api/docs';

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const cognitoHostedUiDomain = configService.get<string>(
    'COGNITO_HOSTED_UI_DOMAIN',
  );
  const cognitoClientId = configService.get<string>('COGNITO_APP_CLIENT_ID');
  const swaggerOauthScopes = parseSwaggerScopes(
    configService.get<string>('COGNITO_SWAGGER_SCOPES'),
  );
  const hasSwaggerOauth = Boolean(cognitoHostedUiDomain && cognitoClientId);

  let swaggerBuilder = new DocumentBuilder()
    .setTitle('WatchParty API')
    .setDescription(
      'WatchParty backend API for Cognito-authenticated auth and room testing',
    )
    .setVersion('1.0');

  if (hasSwaggerOauth) {
    const normalizedHostedUiDomain = normalizeHostedUiDomain(
      cognitoHostedUiDomain as string,
    );
    const oauthScopes = Object.fromEntries(
      swaggerOauthScopes.map((scope) => [scope, `Cognito scope: ${scope}`]),
    );

    swaggerBuilder = swaggerBuilder
      .addOAuth2(
        {
          type: 'oauth2',
          description:
            'Log in with Cognito Hosted UI directly from Swagger Authorize',
          flows: {
            authorizationCode: {
              authorizationUrl: `${normalizedHostedUiDomain}/oauth2/authorize`,
              tokenUrl: `${normalizedHostedUiDomain}/oauth2/token`,
              scopes: oauthScopes,
            },
          },
        },
        'cognito-oauth',
      )
      .addSecurityRequirements('cognito-oauth', swaggerOauthScopes);
  } else {
    swaggerBuilder = swaggerBuilder
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Paste a Cognito access token JWT (without the "Bearer " prefix)',
        },
        'access-token',
      )
      .addSecurityRequirements('access-token');
  }

  const swaggerConfig = swaggerBuilder.build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

  const swaggerSetupOptions: Parameters<typeof SwaggerModule.setup>[3] = {
    swaggerOptions: {
      persistAuthorization: true,
    },
  };

  if (hasSwaggerOauth) {
    const oauth2RedirectUrl = resolveSwaggerOauth2RedirectUrl(
      appPort,
      swaggerDocsPath,
      configService.get<string>('SWAGGER_OAUTH2_REDIRECT_URL'),
    );

    swaggerSetupOptions.swaggerOptions = {
      ...swaggerSetupOptions.swaggerOptions,
      oauth2RedirectUrl,
      initOAuth: {
        clientId: cognitoClientId as string,
        appName: 'WatchParty Swagger',
        scopes: swaggerOauthScopes,
        usePkceWithAuthorizationCodeGrant: true,
      },
    };
  }

  SwaggerModule.setup(
    swaggerDocsPath,
    app,
    swaggerDocument,
    swaggerSetupOptions,
  );

  await app.listen(appPort);
}
bootstrap();
