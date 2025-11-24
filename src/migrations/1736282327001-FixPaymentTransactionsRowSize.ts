import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPaymentTransactionsRowSize1736282327001
  implements MigrationInterface
{
  name = 'FixPaymentTransactionsRowSize1736282327001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix row size issue by reducing VARCHAR lengths and converting to TEXT where appropriate

    // Reduce transaction_id length from 255 to 100 (UUIDs are only 36 chars)
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`transaction_id\` VARCHAR(100) NOT NULL`,
    );

    // Reduce provider_transaction_id length from 255 to 150
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`provider_transaction_id\` VARCHAR(150)`,
    );

    // Convert error_message to LONGTEXT to ensure it's stored off-page
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`error_message\` LONGTEXT`,
    );

    // Convert metadata to LONGTEXT to ensure it's stored off-page
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`metadata\` LONGTEXT`,
    );

    // Reduce other VARCHAR lengths if they don't need 255 characters
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`payment_method\` VARCHAR(30) NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`status\` VARCHAR(30) NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`provider_status\` VARCHAR(30)`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`error_code\` VARCHAR(30)`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`currency\` VARCHAR(3) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert changes back to original sizes
    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`transaction_id\` VARCHAR(255) NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`provider_transaction_id\` VARCHAR(255)`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`error_message\` TEXT`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`metadata\` JSON`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`payment_method\` VARCHAR(50) NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`status\` VARCHAR(50) NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`provider_status\` VARCHAR(50)`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`error_code\` VARCHAR(50)`,
    );

    await queryRunner.query(
      `ALTER TABLE \`payment_transactions\` MODIFY COLUMN \`currency\` VARCHAR(3) NOT NULL`,
    );
  }
}
