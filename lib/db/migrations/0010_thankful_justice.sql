-- Custom SQL migration file, put your code below! --

-- Phase 2: Remove MODE system - drop mode-related columns from Chat table
-- Scorched earth approach: TRUNCATE before ALTER

-- Step 1: TRUNCATE affected tables
TRUNCATE TABLE "Vote" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "Message" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "Stream" CASCADE;--> statement-breakpoint
TRUNCATE TABLE "Chat" CASCADE;--> statement-breakpoint

-- Step 2: Drop mode-related columns from Chat table
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "mode";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "modeSetAt";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "goal";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "goalSetAt";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "todoList";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "todoListUpdatedAt";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "complete";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "completedAt";--> statement-breakpoint
ALTER TABLE "Chat" DROP COLUMN IF EXISTS "firstCompletedAt";--> statement-breakpoint
