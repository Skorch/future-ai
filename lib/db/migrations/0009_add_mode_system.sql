-- Add mode system columns to Chat table
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "mode" TEXT DEFAULT 'discovery';
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "mode_set_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "goal" TEXT;
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "goal_set_at" TIMESTAMP;
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "todo_list" TEXT;
ALTER TABLE "Chat" ADD COLUMN IF NOT EXISTS "todo_list_updated_at" TIMESTAMP;

-- Add index for mode queries
CREATE INDEX IF NOT EXISTS "Chat_mode_idx" ON "Chat" ("mode");

-- Ensure existing chats have a mode
UPDATE "Chat" SET "mode" = 'discovery' WHERE "mode" IS NULL;