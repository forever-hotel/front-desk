import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

config();

const databaseUrl = process.env.DATABASE_URL;

const commonOptions = {
  type: 'postgres' as const,
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
  migrations: ['src/database/migrations/*{.ts,.js}'],
};

let dataSourceOptions: DataSourceOptions;

if (databaseUrl) {
  dataSourceOptions = {
    ...commonOptions,
    url: databaseUrl,
  };
} else {
  const requiredVariables = [
    'DB_HOST',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
  ];

  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      throw new Error(
        `Missing required database environment variable: ${variable}`,
      );
    }
  }

  dataSourceOptions = {
    ...commonOptions,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true',
  };
}

const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
