import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthenticatedPrincipalGuard } from './auth/authenticated-principal.guard';
import { JwtPrincipalResolver } from './auth/jwt-principal.resolver';
import { PrincipalResolver } from './auth/principal-resolver';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [ConfigModule],

  providers: [
    JwtPrincipalResolver,
    {
      provide: PrincipalResolver,
      useExisting: JwtPrincipalResolver,
    },
    AuthenticatedPrincipalGuard,
    RolesGuard,
  ],

  exports: [PrincipalResolver, AuthenticatedPrincipalGuard, RolesGuard],
})
export class SecurityModule {}
