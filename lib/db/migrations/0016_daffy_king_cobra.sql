ALTER TABLE "ObjectiveDocumentVersion" ADD COLUMN "objectiveGoal" text;--> statement-breakpoint
ALTER TABLE "Objective" DROP COLUMN "context";--> statement-breakpoint
ALTER TABLE "Objective" DROP COLUMN "contextUpdatedAt";