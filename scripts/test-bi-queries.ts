#!/usr/bin/env tsx
/**
 * Test queries against BI meeting data
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

async function testQueries() {
  const client = new PineconeClient({
    indexName: process.env.PINECONE_INDEX_NAME || 'rag-agent-poc',
  });

  console.log('Testing queries against BI meeting data...\n');
  console.log('='.repeat(60));

  const queries = [
    'What are the core metrics for executives?',
    'revenue metrics MRR ARR',
    'customer churn and retention',
    'burn rate and runway',
    'executive dashboard requirements',
    'top 5 KPIs for CEO',
    'real-time metrics',
    'data pipeline architecture',
    'mobile dashboard access',
    'alerting thresholds',
  ];

  for (const query of queries) {
    console.log(`\nQuery: "${query}"`);
    console.log('-'.repeat(40));

    const result = await client.queryByText(query, {
      topK: 3,
      namespace: 'test',
      minScore: 0.0, // Show all results for testing
    });

    if (result.matches.length === 0) {
      console.log('  No matches found');
    } else {
      console.log(`  Found ${result.matches.length} matches:`);
      result.matches.forEach((match, i) => {
        console.log(`\n  ${i + 1}. Score: ${match.score.toFixed(4)}`);
        console.log(`     Topic: ${match.metadata.topic || 'N/A'}`);
        console.log(
          `     Speakers: ${match.metadata.speakers?.join(', ') || 'N/A'}`,
        );
        console.log(`     Content: ${match.content.substring(0, 150)}...`);
      });
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Query testing complete!');
}

testQueries().catch(console.error);
