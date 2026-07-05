import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotificationI18nMetadata1765163000000
  implements MigrationInterface
{
  name = 'AddNotificationI18nMetadata1765163000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`notifications\`
      ADD COLUMN \`title_key\` varchar(255) NULL AFTER \`message\`,
      ADD COLUMN \`message_key\` varchar(255) NULL AFTER \`title_key\`,
      ADD COLUMN \`translation_params\` json NULL AFTER \`message_key\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`notifications\`
      DROP COLUMN \`translation_params\`,
      DROP COLUMN \`message_key\`,
      DROP COLUMN \`title_key\`
    `);
  }
}
