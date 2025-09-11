#!/usr/bin/env tsx
/**
 * Load BI Meeting transcript into RAG system for testing
 */

import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { PineconeClient } from '../lib/rag/pinecone-client';
import { parseTranscript } from '../lib/ai/utils/transcript-parser';
import { chunkTranscriptItems } from '../lib/ai/utils/rag-chunker';
import type { RAGDocument } from '../lib/rag/types';

// Load environment variables
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

async function loadBIMeeting() {
  console.log('Loading BI Meeting transcript into RAG system...\n');

  try {
    // Load the transcript
    const content = readFileSync(
      join(process.cwd(), 'test-data/bi-meeting.vtt'),
      'utf-8',
    );

    // Parse the transcript
    const items = parseTranscript(content);
    console.log(`✓ Parsed ${items.length} transcript items`);

    // Generate deterministic hash
    const contentHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    // Chunk with relevant topics
    const topics = [
      'Revenue Metrics',
      'Customer Metrics',
      'Operational Metrics',
      'Data Architecture',
      'Visualization & Reporting',
      'Timeline & Delivery',
    ];

    console.log('\nChunking transcript by topics...');
    const chunks = await chunkTranscriptItems(items, topics, {
      model: 'claude-sonnet-4',
      dryRun: false, // Use real AI for better chunking
    });

    console.log(`✓ Generated ${chunks.length} chunks`);
    chunks.forEach((chunk, i) => {
      console.log(
        `  Chunk ${i + 1}: ${chunk.topic} (${chunk.content.length} chars)`,
      );
    });

    // Convert to RAG documents
    const documents: RAGDocument[] = chunks.map((chunk, index) => ({
      id: `bi-meeting-${contentHash.substring(0, 8)}-chunk-${index}`,
      content: chunk.content,
      metadata: {
        source: 'bi-meeting-transcript',
        type: 'transcript',
        topic: chunk.topic,
        speakers: chunk.metadata.speakers,
        startTime: chunk.metadata.startTime,
        endTime: chunk.metadata.endTime,
        chunkIndex: index,
        totalChunks: chunks.length,
        createdAt: new Date().toISOString(),
        fileHash: contentHash,
        // Additional custom metadata can be added here if needed
      },
    }));

    // Initialize Pinecone client
    const client = new PineconeClient({
      indexName: process.env.PINECONE_INDEX_NAME || 'rag-agent-poc',
    });

    // Clear existing test data first (optional)
    console.log('\nClearing existing test namespace...');
    try {
      await client.deleteNamespace('test');
      console.log('✓ Cleared test namespace');
    } catch (err) {
      console.log('Note: Test namespace might not exist yet');
    }

    // Wait a bit for deletion to process
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Write to Pinecone
    console.log('\nWriting documents to Pinecone...');
    const result = await client.writeDocuments(documents, {
      namespace: 'test',
    });

    if (result.success) {
      console.log(`✓ Successfully wrote ${result.documentsWritten} documents`);
      console.log(`  Namespace: ${result.namespace}`);

      // Wait for indexing
      console.log('\nWaiting for indexing to complete...');
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Test a query
      console.log('\nTesting query: "core metrics for executives"');
      const queryResult = await client.queryByText(
        'core metrics for executives',
        {
          topK: 3,
          namespace: 'test',
          minScore: 0.0,
        },
      );

      console.log(`✓ Found ${queryResult.matches.length} matches`);
      queryResult.matches.forEach((match, i) => {
        console.log(`  ${i + 1}. Score: ${match.score.toFixed(4)}`);
        console.log(`     Topic: ${match.metadata.topic}`);
        console.log(`     Preview: ${match.content.substring(0, 100)}...`);
      });
    } else {
      console.error('✗ Write failed:', result.errors);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
loadBIMeeting().catch(console.error);
