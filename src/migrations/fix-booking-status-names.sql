-- Migration to fix booking status names
-- Update old status names to new enum values

UPDATE booking 
SET status = 'ACCEPTED' 
WHERE status = 'confirmed' OR status = 'CONFIRMED';

UPDATE booking 
SET status = 'ONGOING' 
WHERE status = 'approved' OR status = 'APPROVED';

UPDATE booking 
SET status = 'PENDING' 
WHERE status = 'pending';

UPDATE booking 
SET status = 'COMPLETED' 
WHERE status = 'completed';

UPDATE booking 
SET status = 'CANCELLED' 
WHERE status = 'cancelled';

UPDATE booking 
SET status = 'REJECTED' 
WHERE status = 'rejected';

-- Verify the update
SELECT status, COUNT(*) as count 
FROM booking 
GROUP BY status 
ORDER BY status;