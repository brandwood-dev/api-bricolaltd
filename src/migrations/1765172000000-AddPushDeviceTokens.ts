import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushDeviceTokens1765172000000
  implements MigrationInterface
{
  name = 'AddPushDeviceTokens1765172000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`push_device_tokens\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`expo_push_token\` varchar(255) NOT NULL,
        \`device_id\` varchar(255) NULL,
        \`platform\` varchar(20) NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`last_registered_at\` datetime NULL,
        \`last_error\` text NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_push_device_tokens_expo_push_token\` (\`expo_push_token\`),
        INDEX \`IDX_push_device_tokens_user_id\` (\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX \`IDX_push_device_tokens_user_id\` ON \`push_device_tokens\`
    `);
    await queryRunner.query(`
      DROP INDEX \`IDX_push_device_tokens_expo_push_token\` ON \`push_device_tokens\`
    `);
    await queryRunner.query(`
      DROP TABLE \`push_device_tokens\`
    `);
  }
}
