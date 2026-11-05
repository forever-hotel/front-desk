import { ConfigService } from '@nestjs/config';
import { createConfiguredPrincipalResolver } from './configured-principal.resolver';
import { JwtPrincipalResolver } from './jwt-principal.resolver';
it('uses the same gateway-backed principal resolver for REST and sockets', () => {
  const config = new ConfigService({ AUTH_SERVICE_URL: 'http://gateway' });
  const resolver = new JwtPrincipalResolver(config);
  expect(createConfiguredPrincipalResolver(config, resolver)).toBe(resolver);
});
