import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDepositAutomation1761779800000 implements MigrationInterface {
  name = 'AddDepositAutomation1761779800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ajout des colonnes à la table bookings pour le système de caution automatique
    await queryRunner.query(`
      ALTER TABLE bookings 
      ADD COLUMN stripe_customer_id VARCHAR(255) NULL,
      ADD COLUMN setup_intent_id VARCHAR(255) NULL,
      ADD COLUMN deposit_payment_method_id VARCHAR(255) NULL,
      ADD COLUMN deposit_capture_scheduled_at TIMESTAMP NULL,
      ADD COLUMN deposit_notification_sent_at TIMESTAMP NULL,
      ADD COLUMN deposit_captured_at TIMESTAMP NULL,
      ADD COLUMN deposit_capture_status ENUM('pending', 'success', 'failed', 'cancelled') DEFAULT 'pending',
      ADD COLUMN deposit_failure_reason TEXT NULL
    `);

    // Création de la nouvelle table pour les jobs de capture de caution
    await queryRunner.query(`
      CREATE TABLE deposit_capture_jobs (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        booking_id VARCHAR(36) NOT NULL,
        scheduled_at TIMESTAMP NOT NULL,
        notification_sent_at TIMESTAMP NULL,
        capture_attempted_at TIMESTAMP NULL,
        status ENUM('scheduled', 'notification_sent', 'capturing', 'success', 'failed', 'cancelled') DEFAULT 'scheduled',
        retry_count INT DEFAULT 0,
        last_error TEXT NULL,
        metadata JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        INDEX idx_scheduled_at (scheduled_at),
        INDEX idx_status (status),
        INDEX idx_booking_id (booking_id)
      )
    `);

    // Index pour optimiser les requêtes cron sur la table bookings
    await queryRunner.query(`
      CREATE INDEX idx_bookings_deposit_schedule 
      ON bookings(deposit_capture_scheduled_at, deposit_capture_status)
    `);

    // Index pour optimiser les requêtes sur les customers Stripe
    await queryRunner.query(`
      CREATE INDEX idx_bookings_stripe_customer 
      ON bookings(stripe_customer_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Suppression des index
    await queryRunner.query(`DROP INDEX idx_bookings_stripe_customer ON bookings`);
    await queryRunner.query(`DROP INDEX idx_bookings_deposit_schedule ON bookings`);
    
    // Suppression de la table deposit_capture_jobs
    await queryRunner.query(`DROP TABLE deposit_capture_jobs`);
    
    // Suppression des colonnes ajoutées à la table bookings
    await queryRunner.query(`
      ALTER TABLE bookings 
      DROP COLUMN deposit_failure_reason,
      DROP COLUMN deposit_capture_status,
      DROP COLUMN deposit_captured_at,
      DROP COLUMN deposit_notification_sent_at,
      DROP COLUMN deposit_capture_scheduled_at,
      DROP COLUMN deposit_payment_method_id,
      DROP COLUMN setup_intent_id,
      DROP COLUMN stripe_customer_id
    `);
  }
}