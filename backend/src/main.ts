import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RedactingLoggerService } from './security/redaction/redacting-logger.service';
import { getAllowedOrigins } from './config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(new RedactingLoggerService());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: getAllowedOrigins(),
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
