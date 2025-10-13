ALTER TABLE "ObjectiveDocumentVersion" ADD COLUMN "punchlist" text;--> statement-breakpoint
ALTER TABLE "PlaybookStep" ADD COLUMN "toolCall" varchar(255);--> statement-breakpoint
ALTER TABLE "PlaybookStep" ADD COLUMN "condition" text;