-- Add owner_id column to booking table
ALTER TABLE booking ADD COLUMN owner_id UUID;

-- Add foreign key constraint
ALTER TABLE booking ADD CONSTRAINT fk_booking_owner 
  FOREIGN KEY (owner_id) REFERENCES "user"(id) ON DELETE CASCADE;

-- Update existing bookings to set owner_id based on tool owner
UPDATE booking 
SET owner_id = tool.owner_id 
FROM tool 
WHERE booking.tool_id = tool.id;

-- Make owner_id NOT NULL after updating existing records
ALTER TABLE booking ALTER COLUMN owner_id SET NOT NULL;

-- Create index for better performance
CREATE INDEX idx_booking_owner_id ON booking(owner_id);