-- WARNING: This script will DROP ALL TABLES and RESET THE DATABASE
-- This is a destructive operation that cannot be undone!

-- Drop all tables (CASCADE will handle foreign key constraints)
DROP TABLE IF EXISTS "Suggestion" CASCADE;
DROP TABLE IF EXISTS "Vote_v2" CASCADE;
DROP TABLE IF EXISTS "Vote" CASCADE;
DROP TABLE IF EXISTS "Document" CASCADE;
DROP TABLE IF EXISTS "Message_v2" CASCADE;
DROP TABLE IF EXISTS "Message" CASCADE;
DROP TABLE IF EXISTS "Chat" CASCADE;
DROP TABLE IF EXISTS "Workspace" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "Stream" CASCADE;

-- Drop the Drizzle migrations tracking table
DROP TABLE IF EXISTS "drizzle"."__drizzle_migrations" CASCADE;
DROP SCHEMA IF EXISTS "drizzle" CASCADE;

-- List remaining tables (should be empty)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;