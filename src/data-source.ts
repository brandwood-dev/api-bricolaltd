import { existsSync } from 'fs';
import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

const envFiles = [
  '.env',
  process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : null,
]
  .filter((value): value is string => Boolean(value))
  .map((file) => resolve(process.cwd(), file));

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: true });
  }
}

const configService = new ConfigService();

export default new DataSource({
  type: 'mysql',
  host: configService.get('DB_HOST'),
  port: parseInt(configService.get('DB_PORT') || '3306', 10),
  username: configService.get('DB_USERNAME'),
  password: configService.get('DB_PASSWORD'),
  database: configService.get('DB_NAME'),
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  migrationsTableName: 'migrations',
  synchronize: false, // Disable sync to use migrations
  logging: configService.get('DB_LOGGING') === 'true',
});
