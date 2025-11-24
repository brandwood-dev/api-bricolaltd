import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

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