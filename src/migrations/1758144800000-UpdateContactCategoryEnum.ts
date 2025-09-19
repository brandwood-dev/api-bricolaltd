import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdateContactCategoryEnum1758144800000 implements MigrationInterface {
  name = 'UpdateContactCategoryEnum1758144800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if contacts table exists, if not create it
    const tableExists = await queryRunner.hasTable('contacts');
    
    if (!tableExists) {
      // Create contacts table if it doesn't exist
      await queryRunner.query(`
        CREATE TABLE \`contacts\` (
          \`id\` varchar(36) NOT NULL,
          \`firstName\` varchar(255) NOT NULL,
          \`lastName\` varchar(255) NOT NULL,
          \`email\` varchar(255) NOT NULL,
          \`phone\` varchar(255) NULL,
          \`subject\` varchar(255) NOT NULL,
          \`message\` text NOT NULL,
          \`status\` enum('new', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'new',
          \`category\` enum('technical', 'payment', 'account', 'dispute', 'suggestion', 'other') NOT NULL DEFAULT 'other',
          \`priority\` enum('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
          \`assignedTo\` varchar(255) NULL,
          \`response\` text NULL,
          \`respondedAt\` datetime NULL,
          \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB
      `);
    } else {
      // Check if category column exists
      const categoryColumnExists = await queryRunner.hasColumn('contacts', 'category');
      
      if (!categoryColumnExists) {
        // Add category column if it doesn't exist
        await queryRunner.query(`
          ALTER TABLE \`contacts\` 
          ADD \`category\` enum('technical', 'payment', 'account', 'dispute', 'suggestion', 'other') NOT NULL DEFAULT 'other'
        `);
      } else {
        // Update existing category column to use new enum values
        await queryRunner.query(`
          ALTER TABLE \`contacts\` 
          MODIFY COLUMN \`category\` enum('technical', 'payment', 'account', 'dispute', 'suggestion', 'other') NOT NULL DEFAULT 'other'
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert category column to old enum values if needed
    const tableExists = await queryRunner.hasTable('contacts');
    
    if (tableExists) {
      const categoryColumnExists = await queryRunner.hasColumn('contacts', 'category');
      
      if (categoryColumnExists) {
        await queryRunner.query(`
          ALTER TABLE \`contacts\` 
          MODIFY COLUMN \`category\` enum('general', 'technical', 'billing', 'account', 'booking', 'other') NOT NULL DEFAULT 'other'
        `);
      }
    }
  }
}