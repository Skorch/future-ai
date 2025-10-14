CREATE TYPE "public"."source_type" AS ENUM('transcript', 'email', 'slack', 'note');--> statement-breakpoint
ALTER TABLE "KnowledgeDocument" ADD COLUMN "sourceType" "source_type";--> statement-breakpoint
ALTER TABLE "KnowledgeDocument" ADD COLUMN "sourceDate" timestamp;--> statement-breakpoint
ALTER TABLE "KnowledgeDocument" ADD COLUMN "participants" json;--> statement-breakpoint
ALTER TABLE "KnowledgeDocument" ADD COLUMN "sourceKnowledgeDocumentId" uuid;--> statement-breakpoint
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_sourceKnowledgeDocumentId_KnowledgeDocument_id_fk" FOREIGN KEY ("sourceKnowledgeDocumentId") REFERENCES "public"."KnowledgeDocument"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_knowledge_source" ON "KnowledgeDocument" USING btree ("sourceKnowledgeDocumentId");--> statement-breakpoint
CREATE INDEX "idx_knowledge_source_date" ON "KnowledgeDocument" USING btree ("sourceDate");--> statement-breakpoint
CREATE INDEX "idx_knowledge_source_type" ON "KnowledgeDocument" USING btree ("sourceType");