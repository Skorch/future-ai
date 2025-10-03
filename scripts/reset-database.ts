#!/usr/bin/env tsx

/**
 * Database Reset Script
 *
 * This script completely resets the database by dropping all tables and recreating them.
 * WARNING: This will delete ALL data in the database!
 *
 * Usage: pnpm db:reset
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import path from 'node:path';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Create database connection
if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not defined');
}
const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

async function resetDatabase() {
  console.log('🚨 DATABASE RESET - This will delete ALL data!');
  console.log('Starting database reset...\n');

  try {
    // Step 1: Drop all tables in correct order (dependencies first)
    console.log('📦 Dropping existing tables...');

    const dropStatements = [
      'DROP TABLE IF EXISTS "Vote_v2" CASCADE',
      'DROP TABLE IF EXISTS "Vote" CASCADE',
      'DROP TABLE IF EXISTS "Message_v2" CASCADE',
      'DROP TABLE IF EXISTS "Message" CASCADE',
      'DROP TABLE IF EXISTS "Stream" CASCADE',
      'DROP TABLE IF EXISTS "Suggestion" CASCADE',
      'DROP TABLE IF EXISTS "Document" CASCADE',
      'DROP TABLE IF EXISTS "Chat" CASCADE',
      'DROP TABLE IF EXISTS "Workspace" CASCADE',
      'DROP TABLE IF EXISTS "User" CASCADE',
      'DROP TABLE IF EXISTS "__drizzle_migrations" CASCADE',
    ];

    for (const statement of dropStatements) {
      console.log(`  Executing: ${statement}`);
      await db.execute(sql.raw(statement));
    }

    console.log('✅ All tables dropped successfully\n');

    // Step 2: Run migrations to recreate schema
    console.log('🔨 Running migrations to recreate schema...');

    const migrationsFolder = path.join(process.cwd(), 'lib/db/migrations');
    await migrate(db, { migrationsFolder });

    console.log('✅ Schema recreated successfully\n');

    // Step 3: Verify tables were created
    console.log('🔍 Verifying new schema...');

    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('📊 Created tables:');
    if (result.rows && Array.isArray(result.rows)) {
      result.rows.forEach((row: { table_name: string }) => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('  (No tables found or result format unexpected)');
    }

    console.log('\n✨ Database reset completed successfully!');
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Confirm before resetting
console.log('⚠️  WARNING: This will DELETE ALL DATA in your database!');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
  resetDatabase();
}, 5000);
