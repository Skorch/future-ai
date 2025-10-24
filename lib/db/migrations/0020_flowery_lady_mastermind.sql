ALTER TABLE "ArtifactType" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
-- Migrate existing 'context' values to 'workspaceContext' before enum change
UPDATE "ArtifactType" SET "category" = 'workspaceContext' WHERE "category" = 'context';--> statement-breakpoint
DROP TYPE "public"."artifact_type_category";--> statement-breakpoint
CREATE TYPE "public"."artifact_type_category" AS ENUM('objective', 'summary', 'objectiveActions', 'workspaceContext', 'objectiveContext');--> statement-breakpoint
ALTER TABLE "ArtifactType" ALTER COLUMN "category" SET DATA TYPE "public"."artifact_type_category" USING "category"::"public"."artifact_type_category";--> statement-breakpoint
ALTER TABLE "Domain" ADD COLUMN "isDefault" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "unique_default_domain" ON "Domain" USING btree ("isDefault") WHERE "Domain"."isDefault" = true;