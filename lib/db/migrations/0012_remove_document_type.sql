-- Migration: Remove legacy documentType column from Objective table
-- Phase 3 Step 12: This field was temporary for backward compatibility
-- Now replaced by objectiveDocumentArtifactTypeId FK

ALTER TABLE "Objective" DROP COLUMN IF EXISTS "documentType";