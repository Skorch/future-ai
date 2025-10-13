ALTER TABLE "ObjectiveDocumentVersion" DROP CONSTRAINT "ObjectiveDocumentVersion_chatId_Chat_id_fk";
--> statement-breakpoint
DROP INDEX "idx_objective_version_chat";--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "objectiveDocumentVersionId" uuid;--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_objectiveDocumentVersionId_ObjectiveDocumentVersion_id_fk" FOREIGN KEY ("objectiveDocumentVersionId") REFERENCES "public"."ObjectiveDocumentVersion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_version" ON "Chat" USING btree ("objectiveDocumentVersionId");--> statement-breakpoint
ALTER TABLE "ObjectiveDocumentVersion" DROP COLUMN "chatId";--> statement-breakpoint
ALTER TABLE "ObjectiveDocumentVersion" DROP COLUMN "versionNumber";