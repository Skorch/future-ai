-- Add metadata and sourceDocumentIds columns to Document table
ALTER TABLE "Document"
ADD COLUMN IF NOT EXISTS "metadata" json DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "sourceDocumentIds" json DEFAULT '[]';

-- Note: The kind enum update to only allow 'text' will be handled in s01_strip_unnecessary
-- For now, we're just adding the new fields to support the RAG simplification