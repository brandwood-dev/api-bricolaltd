import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPickupHourType1789052400000 implements MigrationInterface {
  name = 'FixPickupHourType1789052400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ column_type: string; column_default: string | null; is_nullable: string }> =
      await queryRunner.query(`
        SELECT COLUMN_TYPE AS column_type,
               COLUMN_DEFAULT AS column_default,
               IS_NULLABLE AS is_nullable
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'booking'
          AND COLUMN_NAME = 'pickup_hour'
      `);
    const current = rows[0];

    if (!current) {
      await queryRunner.query(`
        ALTER TABLE \`booking\`
          ADD COLUMN \`pickup_hour\` varchar(5) NOT NULL DEFAULT '09:00'
      `);
      return;
    }

    const actions: string[] = [];
    if (current.column_type !== 'varchar(5)') {
      actions.push(
        `MODIFY COLUMN \`pickup_hour\` varchar(5) NOT NULL DEFAULT '09:00'`,
      );
    } else {
      if (current.column_default !== "'09:00'") {
        actions.push(`ALTER COLUMN \`pickup_hour\` SET DEFAULT '09:00'`);
      }
      if (current.is_nullable !== 'NO') {
        actions.push(`MODIFY COLUMN \`pickup_hour\` varchar(5) NOT NULL`);
      }
    }

    if (actions.length > 0) {
      await queryRunner.query(`ALTER TABLE \`booking\` ${actions.join(', ')}`);
    }

    await queryRunner.query(`
      UPDATE \`booking\`
      SET \`pickup_hour\` = '09:00'
      WHERE \`pickup_hour\` IS NULL
         OR \`pickup_hour\` = ''
         OR \`pickup_hour\` REGEXP '^[0-9]+$'
    `);

    await queryRunner.query(`
      UPDATE \`booking\`
      SET \`pickup_hour\` = DATE_FORMAT(CAST(\`pickup_hour\` AS TIME), '%H:%i')
      WHERE \`pickup_hour\` IS NOT NULL
        AND \`pickup_hour\` <> ''
        AND \`pickup_hour\` NOT REGEXP '^[0-9]{2}:[0-9]{2}$'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ column_type: string }> = await queryRunner.query(`
      SELECT COLUMN_TYPE AS column_type
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'booking'
        AND COLUMN_NAME = 'pickup_hour'
    `);
    const current = rows[0];

    if (!current) return;

    if (current.column_type !== 'time') {
      await queryRunner.query(`
        ALTER TABLE \`booking\`
          MODIFY COLUMN \`pickup_hour\` TIME NULL
      `);
    }

    await queryRunner.query(`
      ALTER TABLE \`booking\` ALTER COLUMN \`pickup_hour\` DROP DEFAULT
    `);
  }
}
