ALTER TABLE "ArtifactType" DROP COLUMN IF EXISTS "contextTabLabel";--> statement-breakpoint
ALTER TABLE "ArtifactType" DROP COLUMN IF EXISTS "contextHeaderLabel";--> statement-breakpoint
ALTER TABLE "ArtifactType" DROP COLUMN IF EXISTS "contextDescriptionLabel";--> statement-breakpoint
ALTER TABLE "Domain" DROP COLUMN IF EXISTS "contextTabLabel";--> statement-breakpoint
ALTER TABLE "Domain" DROP COLUMN IF EXISTS "contextHeaderLabel";--> statement-breakpoint
ALTER TABLE "Domain" DROP COLUMN IF EXISTS "contextDescriptionLabel";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "mode";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "modeSetAt";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "goal";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "goalSetAt";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "todoList";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "todoListUpdatedAt";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "complete";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "completedAt";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "firstCompletedAt";--> statement-breakpoint
ALTER TABLE "Objective" DROP COLUMN IF EXISTS "documentType";