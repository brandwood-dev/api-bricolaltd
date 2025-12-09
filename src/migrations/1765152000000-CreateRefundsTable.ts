import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateRefundsTable1765152000000 implements MigrationInterface {
    name = 'CreateRefundsTable1765152000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`refunds\` (
                \`id\` varchar(36) NOT NULL,
                \`refund_id\` varchar(255) NOT NULL,
                \`transaction_id\` varchar(36) NOT NULL,
                \`booking_id\` varchar(36) NULL,
                \`original_amount\` decimal(10,2) NOT NULL,
                \`refund_amount\` decimal(10,2) NOT NULL,
                \`currency\` varchar(3) NOT NULL DEFAULT 'gbp',
                \`status\` enum('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
                \`reason\` enum('CUSTOMER_REQUEST','BOOKING_CANCELLATION','TOOL_UNAVAILABLE','SERVICE_ISSUE','FRAUD','DUPLICATE_PAYMENT','ADMIN_DECISION','OTHER') NOT NULL DEFAULT 'OTHER',
                \`reason_details\` text NULL,
                \`admin_notes\` text NULL,
                \`processed_by\` varchar(36) NULL,
                \`processed_at\` timestamp NULL,
                \`stripe_refund_data\` json NULL,
                \`failure_reason\` text NULL,
                \`wallet_balance_updated\` tinyint NOT NULL DEFAULT 0,
                \`notification_sent\` tinyint NOT NULL DEFAULT 0,
                \`ip_address\` varchar(45) NULL,
                \`user_agent\` text NULL,
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
                \`metadata\` json NULL,
                PRIMARY KEY (\`id\`),
                UNIQUE KEY \`IDX_refund_id\` (\`refund_id\`),
                KEY \`IDX_transaction_id\` (\`transaction_id\`),
                KEY \`IDX_booking_id\` (\`booking_id\`),
                KEY \`IDX_status\` (\`status\`),
                KEY \`IDX_created_at\` (\`created_at\`),
                CONSTRAINT \`FK_transaction_id_refunds\` FOREIGN KEY (\`transaction_id\`) REFERENCES \`transactions\` (\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION,
                CONSTRAINT \`FK_booking_id_refunds\` FOREIGN KEY (\`booking_id\`) REFERENCES \`booking\` (\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE \`refunds\``);
    }
}
