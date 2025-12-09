import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRefundStatusEnum1765152100000 implements MigrationInterface {
    name = 'UpdateRefundStatusEnum1765152100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`refunds\` 
            MODIFY COLUMN \`status\` enum('PENDING','PROCESSING','CONFIRMED','COMPLETED','FAILED','CANCELLED','REJECTED') 
            NOT NULL DEFAULT 'PENDING'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`refunds\` 
            MODIFY COLUMN \`status\` enum('PENDING','PROCESSING','COMPLETED','FAILED','CANCELLED') 
            NOT NULL DEFAULT 'PENDING'
        `);
    }
}
