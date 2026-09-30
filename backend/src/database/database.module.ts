import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');

        const commonOptions = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
          logging: configService.get<boolean>('DB_LOGGING', false),
        };

        if (databaseUrl) {
          return {
            ...commonOptions,
            url: databaseUrl,
          };
        }

        return {
          ...commonOptions,
          host: configService.getOrThrow<string>('DB_HOST'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.getOrThrow<string>('DB_USERNAME'),
          password: configService.getOrThrow<string>('DB_PASSWORD'),
          database: configService.getOrThrow<string>('DB_NAME'),
          ssl: configService.get<boolean>('DB_SSL', true),
        };
      },
    }),
  ],
})
export class DatabaseModule {}
