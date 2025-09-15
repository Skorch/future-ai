-- Create a migration to update the kind enum
-- Note: This requires manual database update to remove unused enum values
-- For now, we'll just add a comment about the change

-- The schema.ts file has been updated to only use 'text' kind
-- But the database enum constraint still allows 'code', 'image', 'sheet'
-- These will be removed in a future migration after existing data is cleaned