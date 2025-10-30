import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixBookingsRowSizeTooLarge1761788900000 implements MigrationInterface {
  name = 'FixBookingsRowSizeTooLarge1761788900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Optimiser les colonnes de la table bookings pour réduire la taille de ligne
    // Convertir les colonnes TEXT et VARCHAR longues en LONGTEXT pour éviter l'erreur "Row size too large"
    
    // Colonnes de message et raisons - peuvent être longues
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`message\` LONGTEXT
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`cancellation_reason\` LONGTEXT
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`cancellation_message\` LONGTEXT
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`refusal_reason\` LONGTEXT
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`refusal_message\` LONGTEXT
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`refund_reason\` LONGTEXT
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`deposit_failure_reason\` LONGTEXT
    `);
    
    // Réduire la taille des colonnes VARCHAR pour les IDs Stripe (max 255 -> 100)
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`payment_intent_id\` VARCHAR(100)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`stripe_customer_id\` VARCHAR(100)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`setup_intent_id\` VARCHAR(100)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`deposit_payment_method_id\` VARCHAR(100)
    `);
    
    // Réduire la taille des autres colonnes VARCHAR
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`payment_method\` VARCHAR(50)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`validation_code\` VARCHAR(50)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revenir aux types précédents (attention: peut causer des pertes de données si les textes sont trop longs)
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`message\` TEXT
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`cancellation_reason\` VARCHAR(255)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`cancellation_message\` VARCHAR(255)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`refusal_reason\` VARCHAR(255)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`refusal_message\` VARCHAR(255)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`refund_reason\` VARCHAR(255)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`deposit_failure_reason\` TEXT
    `);
    
    // Remettre les tailles originales des IDs Stripe
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`payment_intent_id\` VARCHAR(255)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`stripe_customer_id\` VARCHAR(255)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`setup_intent_id\` VARCHAR(255)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`deposit_payment_method_id\` VARCHAR(255)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`payment_method\` VARCHAR(20)
    `);
    
    await queryRunner.query(`
      ALTER TABLE \`bookings\` MODIFY COLUMN \`validation_code\` VARCHAR(255)
    `);
  }
}