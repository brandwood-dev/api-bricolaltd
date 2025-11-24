import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectionReasonToTools1737772100000
  implements MigrationInterface
{
  name = 'AddRejectionReasonToTools1737772100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the rejection_reason column to tools table
    await queryRunner.query(`
      ALTER TABLE \`tools\` 
      ADD \`rejection_reason\` varchar(500) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the rejection_reason column
    await queryRunner.query(`
      ALTER TABLE \`tools\` 
      DROP COLUMN \`rejection_reason\`
    `);
  }
}
