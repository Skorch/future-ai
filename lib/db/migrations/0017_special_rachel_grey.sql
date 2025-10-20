ALTER TABLE "ObjectiveDocumentVersion" RENAME COLUMN "punchlist" TO "objectiveActions";--> statement-breakpoint
ALTER TABLE "Domain" RENAME COLUMN "defaultPunchlistArtifactTypeId" TO "defaultObjectiveActionsArtifactTypeId";--> statement-breakpoint
ALTER TABLE "Objective" RENAME COLUMN "punchlistArtifactTypeId" TO "objectiveActionsArtifactTypeId";--> statement-breakpoint
ALTER TABLE "Domain" DROP CONSTRAINT "Domain_defaultPunchlistArtifactTypeId_ArtifactType_id_fk";
--> statement-breakpoint
ALTER TABLE "Objective" DROP CONSTRAINT "Objective_punchlistArtifactTypeId_ArtifactType_id_fk";
--> statement-breakpoint
ALTER TABLE "ArtifactType" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
UPDATE "ArtifactType" SET "category" = 'objectiveActions' WHERE "category" = 'punchlist';--> statement-breakpoint
DROP TYPE "public"."artifact_type_category";--> statement-breakpoint
CREATE TYPE "public"."artifact_type_category" AS ENUM('objective', 'summary', 'objectiveActions', 'context');--> statement-breakpoint
ALTER TABLE "ArtifactType" ALTER COLUMN "category" SET DATA TYPE "public"."artifact_type_category" USING "category"::"public"."artifact_type_category";--> statement-breakpoint
DROP INDEX "idx_objective_punchlist_artifact_type";--> statement-breakpoint
ALTER TABLE "Domain" ADD CONSTRAINT "Domain_defaultObjectiveActionsArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("defaultObjectiveActionsArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_objectiveActionsArtifactTypeId_ArtifactType_id_fk" FOREIGN KEY ("objectiveActionsArtifactTypeId") REFERENCES "public"."ArtifactType"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_objective_objective_actions_artifact_type" ON "Objective" USING btree ("objectiveActionsArtifactTypeId");