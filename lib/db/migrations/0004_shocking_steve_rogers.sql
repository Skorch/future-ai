-- Drop existing tables from previous Phase 1 attempt (hard reset)
DROP TABLE IF EXISTS "DocumentVersion" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "DocumentEnvelope" CASCADE;--> statement-breakpoint
CREATE TABLE "DocumentEnvelope" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"documentType" text,
	"workspaceId" uuid NOT NULL,
	"createdByUserId" varchar(255) NOT NULL,
	"isSearchable" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "DocumentVersion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentEnvelopeId" uuid NOT NULL,
	"workspaceId" uuid NOT NULL,
	"messageId" uuid,
	"content" text NOT NULL,
	"metadata" json,
	"kind" text DEFAULT 'text' NOT NULL,
	"versionNumber" integer NOT NULL,
	"isActiveDraft" boolean DEFAULT false NOT NULL,
	"isActivePublished" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdByUserId" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "DocumentEnvelope" ADD CONSTRAINT "DocumentEnvelope_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentEnvelope" ADD CONSTRAINT "DocumentEnvelope_createdByUserId_User_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentEnvelopeId_DocumentEnvelope_id_fk" FOREIGN KEY ("documentEnvelopeId") REFERENCES "public"."DocumentEnvelope"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_workspaceId_Workspace_id_fk" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_createdByUserId_User_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_document_envelope_workspace" ON "DocumentEnvelope" USING btree ("workspaceId");--> statement-breakpoint
CREATE INDEX "idx_document_envelope_searchable" ON "DocumentEnvelope" USING btree ("isSearchable");--> statement-breakpoint
CREATE INDEX "idx_document_version_envelope" ON "DocumentVersion" USING btree ("documentEnvelopeId");--> statement-breakpoint
CREATE INDEX "idx_document_version_message" ON "DocumentVersion" USING btree ("messageId");--> statement-breakpoint
CREATE INDEX "idx_document_version_workspace" ON "DocumentVersion" USING btree ("workspaceId");--> statement-breakpoint
-- Partial unique indexes: Only one active draft/published per envelope
CREATE UNIQUE INDEX "one_active_draft_per_envelope" ON "DocumentVersion" ("documentEnvelopeId") WHERE "isActiveDraft" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_published_per_envelope" ON "DocumentVersion" ("documentEnvelopeId") WHERE "isActivePublished" = true;