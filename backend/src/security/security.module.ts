import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticatedPrincipalGuard } from './auth/authenticated-principal.guard';
import { createConfiguredPrincipalResolver } from './auth/configured-principal.resolver';
import { JwtPrincipalResolver } from './auth/jwt-principal.resolver';
import { PrincipalResolver } from './auth/principal-resolver';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [ConfigModule],

  providers: [
    JwtPrincipalResolver,
    {
      provide: PrincipalResolver,
      useFactory: createConfiguredPrincipalResolver,
      inject: [ConfigService, JwtPrincipalResolver],
    },
    AuthenticatedPrincipalGuard,
    RolesGuard,
  ],

  exports: [PrincipalResolver, AuthenticatedPrincipalGuard, RolesGuard],
})
export class SecurityModule {}
