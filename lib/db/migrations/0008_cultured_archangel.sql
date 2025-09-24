ALTER TABLE "Chat" ADD COLUMN "mode" text DEFAULT 'discovery';--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "mode_set_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "goal" text;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "goal_set_at" timestamp;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "todo_list" text;--> statement-breakpoint
ALTER TABLE "Chat" ADD COLUMN "todo_list_updated_at" timestamp;