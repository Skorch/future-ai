#!/usr/bin/env tsx
/**
 * Debug script to test query with lower threshold
 */

import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { PineconeClient } from '../lib/rag/pinecone-client';

// Load environment variables
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

async function debugQuery() {
  const client = new PineconeClient({
    indexName: process.env.PINECONE_INDEX_NAME || 'rag-agent-poc',
  });

  console.log('Testing query with different thresholds...\n');

  const queries = [
    'What is the main topic?',
    'test',
    'document',
    'hello world',
  ];

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    console.log('-'.repeat(40));

    // Try with no minimum score
    const result = await client.queryByText(query, {
      topK: 5,
      namespace: 'test',
      minScore: 0, // No threshold
    });

    if (result.matches.length === 0) {
      console.log('  No matches found even with minScore=0');
    } else {
      console.log(`  Found ${result.matches.length} matches:`);
      result.matches.forEach((match, i) => {
        console.log(
          `    ${i + 1}. Score: ${match.score.toFixed(4)} - ID: ${match.id}`,
        );
        console.log(
          `       Content preview: ${match.content.substring(0, 100)}...`,
        );
        console.log(`       Metadata: ${JSON.stringify(match.metadata)}`);
      });
    }
  }
}

debugQuery().catch(console.error);
