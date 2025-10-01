-- Migration: Knowledge Management Foundation
-- Adds columns and indexes to support document navigation, soft delete, and RAG control

-- Add new columns to Document table
ALTER TABLE "Document"
ADD COLUMN IF NOT EXISTS "documentType" TEXT NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS "isSearchable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
--> statement-breakpoint

-- Migrate existing metadata.documentType values to new column
UPDATE "Document"
SET "documentType" = COALESCE(
  CAST(metadata->>'documentType' AS TEXT),
  'text'
)
WHERE metadata->>'documentType' IS NOT NULL;
--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_document_deleted_at" ON "Document"("deletedAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_searchable" ON "Document"("isSearchable");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_document_workspace_deleted" ON "Document"("workspaceId", "deletedAt");
