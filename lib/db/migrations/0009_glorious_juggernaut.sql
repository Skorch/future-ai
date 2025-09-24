ALTER TABLE "Chat" ADD COLUMN "complete" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "first_completed_at" timestamp;