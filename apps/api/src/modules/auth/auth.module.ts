import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CognitoAuthGuard } from '../../common/guards/cognito-auth.guard';
import { AuthController } from './auth.controller';
import { CognitoJwtVerifierService } from './cognito-jwt-verifier.service';

@Module({
  imports: [ConfigModule],
  controllers: [AuthController],
  providers: [CognitoJwtVerifierService, CognitoAuthGuard],
  exports: [CognitoJwtVerifierService],
})
export class AuthModule { }