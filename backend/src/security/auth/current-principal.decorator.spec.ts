import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthenticatedPrincipal } from './authenticated-principal';
import { CurrentPrincipal } from './current-principal.decorator';
import { SystemRole } from './system-role';

@Controller('current-principal-test')
class CurrentPrincipalTestController {
  @Get()
  getPrincipal(
    @CurrentPrincipal()
    principal: AuthenticatedPrincipal,
  ): AuthenticatedPrincipal {
    return principal;
  }
}

describe('CurrentPrincipal decorator', () => {
  let app: INestApplication<App>;

  const principal: AuthenticatedPrincipal = {
    userId: '66666666-6666-4666-8666-666666666666',

    role: SystemRole.RECEPTIONIST,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CurrentPrincipalTestController],
    }).compile();

    app = moduleRef.createNestApplication();

    app.use(
      (
        req: {
          authenticatedPrincipal?: AuthenticatedPrincipal;
        },
        _res: unknown,
        next: () => void,
      ) => {
        req.authenticatedPrincipal = principal;

        next();
      },
    );

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should return the authenticated principal from the request', async () => {
    await request(app.getHttpServer())
      .get('/current-principal-test')
      .expect(200)
      .expect(principal);
  });
});
