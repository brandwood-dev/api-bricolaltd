import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNewUserFields1737973000000 implements MigrationInterface {
  name = 'AddNewUserFields1737973000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add the new user fields to users table
    await queryRunner.query(`
      ALTER TABLE \`users\` 
      ADD \`country\` varchar(255) NULL,
      ADD \`adress\` varchar(255) NULL,
      ADD \`prefix\` varchar(255) NULL,
      ADD \`phone\` varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the new user fields
    await queryRunner.query(`
      ALTER TABLE \`users\` 
      DROP COLUMN \`country\`,
      DROP COLUMN \`adress\`,
      DROP COLUMN \`prefix\`,
      DROP COLUMN \`phone\`
    `);
  }
}