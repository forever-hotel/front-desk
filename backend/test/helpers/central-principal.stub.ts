import { jwtVerify } from 'jose';
import { isUUID } from 'class-validator';
import { isSystemRole } from '../../src/security/auth/system-role';
export function testPrincipalResolver(secret: string, issuer: string) {
  return {
    resolve: async (request: {
      headers: Record<string, string | string[] | undefined>;
    }) => {
      try {
        const header =
          request.headers.authorization ?? request.headers.Authorization;
        if (typeof header !== 'string' || !header.startsWith('Bearer '))
          return null;
        const { payload } = await jwtVerify(
          header.slice(7),
          new TextEncoder().encode(secret),
          { algorithms: ['HS256'], issuer },
        );
        if (
          typeof payload.sub !== 'string' ||
          !isUUID(payload.sub, '4') ||
          !isSystemRole(payload.role)
        )
          return null;
        return { userId: payload.sub, role: payload.role };
      } catch {
        return null;
      }
    },
  };
}
