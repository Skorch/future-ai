ALTER TABLE "KnowledgeDocument" DROP CONSTRAINT "KnowledgeDocument_sourceKnowledgeDocumentId_KnowledgeDocument_id_fk";
--> statement-breakpoint
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_sourceKnowledgeDocumentId_fk" FOREIGN KEY ("sourceKnowledgeDocumentId") REFERENCES "public"."KnowledgeDocument"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN "visibility";