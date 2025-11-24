import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCurrencyTables1760984200000 implements MigrationInterface {
  name = 'CreateCurrencyTables1760984200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create currencies table
    await queryRunner.query(`
      CREATE TABLE currencies (
        code VARCHAR(3) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        symbol VARCHAR(10) NOT NULL,
        flag TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create index for active currencies
    await queryRunner.query(`
      CREATE INDEX idx_currencies_active ON currencies(is_active)
    `);

    // Insert initial currency data (7 supported currencies)
    await queryRunner.query(`
      INSERT INTO currencies (code, name, symbol, flag, is_active) VALUES
      ('GBP', 'British Pound Sterling', '£', '<span class="fi fi-gb"></span>', true),
      ('KWD', 'Kuwaiti Dinar', 'د.ك', '<span class="fi fi-kw"></span>', true),
      ('SAR', 'Saudi Riyal', '﷼', '<span class="fi fi-sa"></span>', true),
      ('BHD', 'Bahraini Dinar', '.د.ب', '<span class="fi fi-bh"></span>', true),
      ('OMR', 'Omani Rial', '﷼', '<span class="fi fi-om"></span>', true),
      ('QAR', 'Qatari Riyal', '﷼', '<span class="fi fi-qa"></span>', true),
      ('AED', 'UAE Dirham', 'د.إ', '<span class="fi fi-ae"></span>', true)
    `);

    // Create exchange_rates table
    await queryRunner.query(`
      CREATE TABLE exchange_rates (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        from_currency VARCHAR(3) NOT NULL,
        to_currency VARCHAR(3) NOT NULL,
        rate DECIMAL(15,6) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_currency_pair (from_currency, to_currency),
        FOREIGN KEY (from_currency) REFERENCES currencies(code),
        FOREIGN KEY (to_currency) REFERENCES currencies(code)
      )
    `);

    // Create indexes for exchange_rates
    await queryRunner.query(`
      CREATE INDEX idx_exchange_rates_from_to ON exchange_rates(from_currency, to_currency)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_exchange_rates_updated ON exchange_rates(updated_at DESC)
    `);

    // Add constraint to prevent same currency pairs
    await queryRunner.query(`
      ALTER TABLE exchange_rates ADD CONSTRAINT chk_different_currencies 
      CHECK (from_currency != to_currency)
    `);

    // Add default_currency column to users table
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN default_currency VARCHAR(3) DEFAULT 'GBP'
    `);

    await queryRunner.query(`
      ALTER TABLE users ADD FOREIGN KEY (default_currency) REFERENCES currencies(code)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_users_default_currency ON users(default_currency)
    `);

    // Add base_currency column to tools table
    await queryRunner.query(`
      ALTER TABLE tools ADD COLUMN base_currency VARCHAR(3) DEFAULT 'GBP'
    `);

    await queryRunner.query(`
      ALTER TABLE tools ADD FOREIGN KEY (base_currency) REFERENCES currencies(code)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_tools_base_currency ON tools(base_currency)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove foreign key constraints and columns from tools
    await queryRunner.query(`
      ALTER TABLE tools DROP FOREIGN KEY tools_ibfk_base_currency
    `);
    await queryRunner.query(`
      DROP INDEX idx_tools_base_currency ON tools
    `);
    await queryRunner.query(`
      ALTER TABLE tools DROP COLUMN base_currency
    `);

    // Remove foreign key constraints and columns from users
    await queryRunner.query(`
      ALTER TABLE users DROP FOREIGN KEY users_ibfk_default_currency
    `);
    await queryRunner.query(`
      DROP INDEX idx_users_default_currency ON users
    `);
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN default_currency
    `);

    // Drop exchange_rates table
    await queryRunner.query(`DROP TABLE exchange_rates`);

    // Drop currencies table
    await queryRunner.query(`DROP TABLE currencies`);
  }
}
