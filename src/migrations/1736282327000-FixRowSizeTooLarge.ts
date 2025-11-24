import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixRowSizeTooLarge1736282327000 implements MigrationInterface {
  name = 'FixRowSizeTooLarge1736282327000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert TEXT columns to LONGTEXT to fix row size issues

    // UserActivity entity
    await queryRunner.query(
      `ALTER TABLE \`user_activities\` MODIFY COLUMN \`description\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_activities\` MODIFY COLUMN \`metadata\` LONGTEXT`,
    );

    // Tool entity
    await queryRunner.query(
      `ALTER TABLE \`tools\` MODIFY COLUMN \`description\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tools\` MODIFY COLUMN \`pickup_address\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tools\` MODIFY COLUMN \`owner_instructions\` LONGTEXT`,
    );

    // Review entities
    await queryRunner.query(
      `ALTER TABLE \`reviews\` MODIFY COLUMN \`comment\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`review_tools\` MODIFY COLUMN \`comment\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`review_apps\` MODIFY COLUMN \`comment\` LONGTEXT`,
    );

    // SecurityLog entity
    await queryRunner.query(
      `ALTER TABLE \`security_logs\` MODIFY COLUMN \`description\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`security_logs\` MODIFY COLUMN \`metadata\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`security_logs\` MODIFY COLUMN \`notes\` LONGTEXT`,
    );

    // Notification entities
    await queryRunner.query(
      `ALTER TABLE \`notifications\` MODIFY COLUMN \`message\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notification_templates\` MODIFY COLUMN \`message_template\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notification_templates\` MODIFY COLUMN \`email_template\` LONGTEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`admin_notifications\` MODIFY COLUMN \`message\` LONGTEXT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert LONGTEXT columns back to TEXT

    // UserActivity entity
    await queryRunner.query(
      `ALTER TABLE \`user_activities\` MODIFY COLUMN \`description\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_activities\` MODIFY COLUMN \`metadata\` TEXT`,
    );

    // Tool entity
    await queryRunner.query(
      `ALTER TABLE \`tools\` MODIFY COLUMN \`description\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tools\` MODIFY COLUMN \`pickup_address\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tools\` MODIFY COLUMN \`owner_instructions\` TEXT`,
    );

    // Review entities
    await queryRunner.query(
      `ALTER TABLE \`reviews\` MODIFY COLUMN \`comment\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`review_tools\` MODIFY COLUMN \`comment\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`review_apps\` MODIFY COLUMN \`comment\` TEXT`,
    );

    // SecurityLog entity
    await queryRunner.query(
      `ALTER TABLE \`security_logs\` MODIFY COLUMN \`description\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`security_logs\` MODIFY COLUMN \`metadata\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`security_logs\` MODIFY COLUMN \`notes\` TEXT`,
    );

    // Notification entities
    await queryRunner.query(
      `ALTER TABLE \`notifications\` MODIFY COLUMN \`message\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notification_templates\` MODIFY COLUMN \`message_template\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`notification_templates\` MODIFY COLUMN \`email_template\` TEXT`,
    );
    await queryRunner.query(
      `ALTER TABLE \`admin_notifications\` MODIFY COLUMN \`message\` TEXT`,
    );
  }
}
