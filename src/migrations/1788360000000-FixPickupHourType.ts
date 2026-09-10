import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixPickupHourType1788360000000 implements MigrationInterface {
  name = 'FixPickupHourType1788360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "pickup_hour" TYPE varchar(5) USING coalesce(left("pickup_hour"::varchar, 5), '09:00')`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "pickup_hour" SET DEFAULT '09:00'`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "pickup_hour" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "pickup_hour" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ALTER COLUMN "pickup_hour" TYPE TIME USING "pickup_hour"::time`,
    );
  }
}
