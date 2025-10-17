-- SCORCHED EARTH: Drop all workspace/objective/chat/knowledge data
-- Required because we're changing Workspace.domainId from varchar to uuid
-- and adding NOT NULL FK columns to existing tables
TRUNCATE TABLE "Vote" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "Message" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "Stream" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "Chat" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "ObjectiveDocumentVersion" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "KnowledgeDocument" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "Objective" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "ObjectiveDocument" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "Workspace" CASCADE;--> statement-breakpoint
CREATE TYPE "public"."artifact_type_category" AS ENUM('objective', 'summary', 'punchlist', 'context');--> statement-breakpoint
CREATE TABLE "ArtifactType" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "artifact_type_category" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"instructionPrompt" text NOT NULL,
	"template" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedByUserId" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "Domain" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"systemPrompt" text NOT NULL,
	"defaultObjectiveArtifactTypeId" uuid NOT NULL,
	"defaultSummaryArtifactTypeId" uuid NOT NULL,
	"defaultPunchlistArtifactTypeId" uuid NOT NULL,
	"defaultWorkspaceContextArtifactTypeId" uuid NOT NULL,
	"defaultObjectiveContextArtifactTypeId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"updatedByUserId" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "Workspace" ALTER COLUMN "domainId" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "Workspace" ALTER COLUMN "domainId" SET DATA TYPE uuid USING "domainId"::uuid;--> statement-breakpoint
ALTER TABLE "Objective" ADD COLUMN "objectiveContextArtifactTypeId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "Objective" ADD COLUMN "objectiveDocumentArtifactTypeId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "Objective" ADD COLUMN "punchlistArtifactTypeId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "Objective" ADD COLUMN "summaryArtifactTypeId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "Workspace" ADD COLUMN "workspaceContextArtifactTypeId" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ArtifactType" ADD CONSTRAINT "ArtifactType_updatedByUserId_User_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_defaultObjectiveArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("defaultObjectiveArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_defaultSummaryArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("defaultSummaryArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_defaultPunchlistArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("defaultPunchlistArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_defaultWorkspaceContextArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("defaultWorkspaceContextArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_defaultObjectiveContextArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("defaultObjectiveContextArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_updatedByUserId_User_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_artifact_type_category" ON "ArtifactType" USING btree ("category");--> statement-breakpoint
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_objectiveContextArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("objectiveContextArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_objectiveDocumentArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("objectiveDocumentArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_punchlistArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("punchlistArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_summaryArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("summaryArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_domainId_Domain_id_fk" FOREIGN KEY ("domainId") REFERENCES "public"."Domain"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_workspaceContextArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("workspaceContextArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_objective_context_artifact_type" ON "Objective" USING btree ("objectiveContextArtifactTypeId");--> statement-breakpoint
CREATE INDEX "idx_objective_document_artifact_type" ON "Objective" USING btree ("objectiveDocumentArtifactTypeId");--> statement-breakpoint
CREATE INDEX "idx_objective_punchlist_artifact_type" ON "Objective" USING btree ("punchlistArtifactTypeId");--> statement-breakpoint
CREATE INDEX "idx_objective_summary_artifact_type" ON "Objective" USING btree ("summaryArtifactTypeId");--> statement-breakpoint
CREATE INDEX "workspace_context_artifact_type_idx" ON "Workspace" USING btree ("workspaceContextArtifactTypeId");