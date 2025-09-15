ALTER TABLE "Document" ADD COLUMN "metadata" json DEFAULT '{}'::json;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "sourceDocumentIds" json DEFAULT '[]'::json;