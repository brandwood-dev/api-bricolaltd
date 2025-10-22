-- Migration: Add payment-related fields to booking table
-- Date: 2025-01-11
-- Description: Add Stripe payment integration fields to the booking entity

-- Add payment_intent_id column
ALTER TABLE booking 
ADD COLUMN payment_intent_id VARCHAR(255) NULL;

-- Add payment_status column with enum values
ALTER TABLE booking 
ADD COLUMN payment_status ENUM('pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded') 
DEFAULT 'pending';

-- Add payment_holds column for JSON data
ALTER TABLE booking 
ADD COLUMN payment_holds JSON NULL;

-- Add stripe_customer_id column
ALTER TABLE booking 
ADD COLUMN stripe_customer_id VARCHAR(255) NULL;

-- Add payment_captured_at timestamp
ALTER TABLE booking 
ADD COLUMN payment_captured_at TIMESTAMP NULL;

-- Add refund_amount column
ALTER TABLE booking 
ADD COLUMN refund_amount DECIMAL(10,2) NULL;

-- Add refund_reason column
ALTER TABLE booking 
ADD COLUMN refund_reason TEXT NULL;

-- Add indexes for better query performance
CREATE INDEX idx_booking_payment_intent_id ON booking(payment_intent_id);
CREATE INDEX idx_booking_payment_status ON booking(payment_status);
CREATE INDEX idx_booking_stripe_customer_id ON booking(stripe_customer_id);

-- Add comments for documentation
ALTER TABLE booking 
MODIFY COLUMN payment_intent_id VARCHAR(255) NULL COMMENT 'Stripe Payment Intent ID for this booking';

ALTER TABLE booking 
MODIFY COLUMN payment_status ENUM('pending', 'authorized', 'captured', 'failed', 'cancelled', 'refunded') 
DEFAULT 'pending' COMMENT 'Payment status for this booking';

ALTER TABLE booking 
MODIFY COLUMN payment_holds JSON NULL COMMENT 'JSON object containing payment hold information';

ALTER TABLE booking 
MODIFY COLUMN stripe_customer_id VARCHAR(255) NULL COMMENT 'Stripe Customer ID for the renter';

ALTER TABLE booking 
MODIFY COLUMN payment_captured_at TIMESTAMP NULL COMMENT 'Timestamp when payment was captured';

ALTER TABLE booking 
MODIFY COLUMN refund_amount DECIMAL(10,2) NULL COMMENT 'Amount refunded for this booking';

ALTER TABLE booking 
MODIFY COLUMN refund_reason TEXT NULL COMMENT 'Reason for refund';