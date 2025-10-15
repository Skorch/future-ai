/**
 * Database Connection Factory
 *
 * Provides the appropriate database connection based on environment:
 * - Local development: Uses postgres package with standard PostgreSQL
 * - Production/Vercel: Uses @vercel/postgres with WebSocket
 */

import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import { drizzle as drizzleVercel } from 'drizzle-orm/vercel-postgres';
import postgres from 'postgres';
import { sql as vercelSql } from '@vercel/postgres';
import {
  user,
  chat,
  message,
  vote,
  stream,
  documentEnvelope,
  documentVersion,
  documentEnvelopeRelations,
  documentVersionRelations,
  workspace,
  playbook,
  playbookStep,
} from './schema';

/**
 * Detects if we're running locally based on connection string
 */
function isLocalDevelopment(): boolean {
  const url = process.env.POSTGRES_URL || '';
  return url.includes('localhost') || url.includes('127.0.0.1');
}

/**
 * Creates the appropriate database connection for the environment
 */
export function createDatabaseConnection() {
  const isLocal = isLocalDevelopment();

  // Schema configuration - same for both environments
  const schemaConfig = {
    user,
    chat,
    message,
    vote,
    stream,
    documentEnvelope,
    documentVersion,
    documentEnvelopeRelations,
    documentVersionRelations,
    workspace,
    playbook,
    playbookStep,
  };

  if (isLocal) {
    // Local development: Use standard PostgreSQL connection
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL is not defined');
    }

    const client = postgres(connectionString);
    return drizzlePostgres(client, { schema: schemaConfig });
  } else {
    // Production/Vercel: Use @vercel/postgres
    return drizzleVercel(vercelSql, { schema: schemaConfig });
  }
}

// Create and export a singleton database instance
export const db = createDatabaseConnection();
