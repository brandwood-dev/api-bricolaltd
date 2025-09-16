import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateToolsModerationStatus1737711900000 implements MigrationInterface {
  name = 'UpdateToolsModerationStatus1737711900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the new moderation_status column with enum type
    await queryRunner.query(`
      ALTER TABLE \`tools\` 
      ADD \`moderation_status\` enum('Pending', 'Confirmed', 'Rejected') 
      NOT NULL DEFAULT 'Pending'
    `);

    // Update existing records: if moderated_at is not null, set status to 'Confirmed'
    await queryRunner.query(`
      UPDATE \`tools\` 
      SET \`moderation_status\` = 'Confirmed' 
      WHERE \`moderated_at\` IS NOT NULL
    `);

    // Drop the old moderated_at column
    await queryRunner.query(`
      ALTER TABLE \`tools\` 
      DROP COLUMN \`moderated_at\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add back the moderated_at column
    await queryRunner.query(`
      ALTER TABLE \`tools\` 
      ADD \`moderated_at\` datetime NULL
    `);

    // Update existing records: if moderation_status is 'Confirmed', set moderated_at to current timestamp
    await queryRunner.query(`
      UPDATE \`tools\` 
      SET \`moderated_at\` = NOW() 
      WHERE \`moderation_status\` = 'Confirmed'
    `);

    // Drop the moderation_status column
    await queryRunner.query(`
      ALTER TABLE \`tools\` 
      DROP COLUMN \`moderation_status\`
    `);
  }
}