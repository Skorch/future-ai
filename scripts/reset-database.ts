#!/usr/bin/env tsx

/**
 * Database Reset Script - Scorched Earth Approach
 *
 * This script performs a complete database reset:
 * 1. Drops entire public schema (all tables)
 * 2. Removes all migration files
 * 3. Clears drizzle metadata
 * 4. Generates fresh migration from new schema
 * 5. Applies migration
 *
 * WARNING: This will DELETE ALL DATA with no recovery!
 *
 * Usage: pnpm db:reset
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { execSync } from 'node:child_process';
import { existsSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

if (!process.env.POSTGRES_URL) {
  throw new Error('POSTGRES_URL is not defined');
}

const client = postgres(process.env.POSTGRES_URL);
const db = drizzle(client);

async function resetDatabase() {
  console.log('🚨 SCORCHED EARTH DATABASE RESET');
  console.log('This will DELETE ALL DATA and cannot be undone!\n');

  try {
    // Step 1: Drop entire public schema (nuclear option)
    console.log('💣 Dropping entire public schema...');
    await db.execute(sql`DROP SCHEMA public CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    // Note: Skipping GRANT statements for Vercel Postgres (managed service)
    console.log('✅ Schema dropped and recreated\n');

    // Step 2: Remove all old migration files
    console.log('🗑️  Removing old migration files...');
    const migrationsPath = join(process.cwd(), 'lib/db/migrations');
    if (existsSync(migrationsPath)) {
      const files = readdirSync(migrationsPath);
      files.forEach((file) => {
        if (file.endsWith('.sql')) {
          const filePath = join(migrationsPath, file);
          console.log(`  Removing: ${file}`);
          rmSync(filePath);
        }
      });
    }
    console.log('✅ Old migrations removed\n');

    // Step 3: Clear drizzle metadata
    console.log('🧹 Clearing drizzle metadata...');
    const metaPath = join(process.cwd(), 'lib/db/migrations/meta');
    if (existsSync(metaPath)) {
      rmSync(metaPath, { recursive: true, force: true });
      console.log('✅ Metadata cleared\n');
    }

    // Step 4: Generate fresh migration from new schema
    console.log('🏗️  Generating fresh migration from schema...');
    execSync('pnpm db:generate', { stdio: 'inherit' });
    console.log('✅ New migration generated\n');

    // Step 5: Apply the fresh migration
    console.log('🚀 Applying migration...');
    const migrationsFolder = join(process.cwd(), 'lib/db/migrations');
    await migrate(db, { migrationsFolder });
    console.log('✅ Migration applied\n');

    // Step 6: Verify new schema
    console.log('🔍 Verifying new schema...');
    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log('📊 Created tables:');
    const tables = (result.rows || result) as { table_name: string }[];
    if (Array.isArray(tables)) {
      tables.forEach((row) => {
        console.log(`  ✓ ${row.table_name}`);
      });
    } else {
      console.log('  (Unable to display table list)');
    }

    console.log('\n✨ Scorched earth database reset completed successfully!');
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    await client.end();
    process.exit(1);
  }
}

// Confirm before resetting
console.log('⚠️  WARNING: SCORCHED EARTH - This will DELETE ALL DATA!');
console.log('⚠️  There is NO UNDO for this operation!');
console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
  resetDatabase();
}, 5000);
