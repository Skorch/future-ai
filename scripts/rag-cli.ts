#!/usr/bin/env tsx
/**
 * RAG CLI Testing Tool
 * Comprehensive command-line interface for testing RAG operations
 */

import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { PineconeClient } from '../lib/rag/pinecone-client';
import {
  parseTranscript,
  parseDocument,
} from '../lib/ai/utils/transcript-parser';
import { chunkTranscriptItems } from '../lib/ai/utils/rag-chunker';
import { createReranker } from '../lib/rag/reranker';
import type {
  RAGDocument,
  TranscriptItem,
  ChunkResult,
} from '../lib/rag/types';

// Load environment variables
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Configuration
const INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rag-agent-poc';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message: string) {
  console.error(`${colors.red}✗ ${message}${colors.reset}`);
}

function success(message: string) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function info(message: string) {
  console.log(`${colors.cyan}ℹ ${message}${colors.reset}`);
}

function warning(message: string) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function header(message: string) {
  console.log(
    `\n${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}`,
  );
  console.log(`${colors.bright}${colors.blue}  ${message}${colors.reset}`);
  console.log(
    `${colors.bright}${colors.blue}${'='.repeat(60)}${colors.reset}\n`,
  );
}

// Helper function to load test files
function loadTestFile(filename: string): string {
  const testDataPath = join(process.cwd(), 'test-data', filename);
  const fixturesPath = join(process.cwd(), '__tests__', 'fixtures', filename);

  if (existsSync(testDataPath)) {
    return readFileSync(testDataPath, 'utf-8');
  } else if (existsSync(fixturesPath)) {
    return readFileSync(fixturesPath, 'utf-8');
  } else {
    throw new Error(`Test file not found: ${filename}`);
  }
}

// Type definitions for test results
type FileLoadingResult = {
  file: string;
  format: string;
  success: boolean;
  itemCount?: number;
  error?: string;
};

type ChunkingResult = {
  testCase: string;
  chunkCount: number;
  avgSize: number;
  uniqueTopics: number;
  topics: string;
};

type ConsistencyResult = {
  iteration: number;
  matchCount: number;
  topScore: number;
  topId: string;
  topContent: string;
};

type QueryTestResult = {
  query: string;
  matchCount: number;
  topScore: number;
};

type IntegrationTestResult = {
  test: string;
  status: string;
  error?: string;
};

// Test file loading for different formats
async function testFileLoading() {
  header('Testing File Loading for Different Formats');

  const testFiles = [
    { name: 'sample.vtt', format: 'webvtt', type: 'transcript' },
    { name: 'sample.fathom', format: 'fathom', type: 'transcript' },
    { name: 'sample.md', format: 'markdown', type: 'document' },
    { name: 'sample.txt', format: 'text', type: 'document' },
  ];

  const results: FileLoadingResult[] = [];

  for (const file of testFiles) {
    try {
      info(`Testing ${file.name} (${file.format})`);
      const content = loadTestFile(file.name);

      let parsed: TranscriptItem[];
      if (file.type === 'transcript') {
        parsed = parseTranscript(content);
      } else {
        parsed = parseDocument(content);
      }

      success(`✓ ${file.name}: Parsed ${parsed.length} items`);
      results.push({
        file: file.name,
        format: file.format,
        success: true,
        itemCount: parsed.length,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error(`✗ ${file.name}: ${errorMessage}`);
      results.push({
        file: file.name,
        format: file.format,
        success: false,
        error: errorMessage,
      });
    }
  }

  // Summary
  console.log(`\n${colors.bright}File Loading Summary:${colors.reset}`);
  console.table(results);

  return results;
}

// Wrapper for chunking with progress feedback
async function chunkWithFeedback(
  items: TranscriptItem[],
  topics: string[],
  options: { model: string; dryRun: boolean },
  description: string,
) {
  info(`  Preparing to chunk ${items.length} items...`);

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(`Chunking timeout after 30 seconds for: ${description}`),
      );
    }, 30000); // 30 second timeout
  });

  // Create the chunking promise
  const chunkPromise = (async () => {
    try {
      info(`  Calling AI model: ${options.model}`);
      const result = await chunkTranscriptItems(items, topics, options);
      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      error(`  Chunking error: ${errorMsg}`);
      throw err;
    }
  })();

  // Race between timeout and actual work
  try {
    const result = await Promise.race([chunkPromise, timeoutPromise]);
    return result as ChunkResult[];
  } catch (err) {
    if (err instanceof Error && err.message.includes('timeout')) {
      warning(`  ${err.message}`);
      warning(`  Falling back to dry run mode...`);
      // Fallback to dry run
      return await chunkTranscriptItems(items, topics, {
        ...options,
        dryRun: true,
      });
    }
    throw err;
  }
}

// Test chunking behavior
async function testChunking() {
  header('Testing Chunking Behavior');

  try {
    // Load a sample transcript
    const content = loadTestFile('sample.vtt');
    const items = parseTranscript(content);

    info(`Loaded ${items.length} transcript items`);

    // Test with different topic configurations
    const testCases = [
      { topics: [], description: 'No topics (automatic detection)' },
      {
        topics: ['introduction', 'main points', 'conclusion'],
        description: 'Predefined topics',
      },
      {
        topics: ['technical', 'business', 'strategy'],
        description: 'Domain-specific topics',
      },
    ];

    const results: ChunkingResult[] = [];

    for (const testCase of testCases) {
      info(`\nTesting: ${testCase.description}`);
      info(`  Items to chunk: ${items.length}`);
      info(
        `  Topics: ${testCase.topics.length === 0 ? 'Auto-detect' : testCase.topics.join(', ')}`,
      );

      const startTime = Date.now();

      const chunks = await chunkWithFeedback(
        items,
        testCase.topics,
        {
          model: 'claude-sonnet-4',
          dryRun: false,
        },
        testCase.description,
      );

      const duration = Date.now() - startTime;
      success(`  Generated ${chunks.length} chunks in ${duration}ms`);

      // Analyze chunk characteristics
      const avgSize =
        chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length;
      const topics = [...new Set(chunks.map((c) => c.topic))];

      results.push({
        testCase: testCase.description,
        chunkCount: chunks.length,
        avgSize: Math.round(avgSize),
        uniqueTopics: topics.length,
        topics: topics.join(', '),
      });

      // Show chunk details
      chunks.forEach((chunk, i) => {
        log(
          `  Chunk ${i + 1}: Topic="${chunk.topic}", Size=${chunk.content.length} chars`,
          colors.cyan,
        );
      });
    }

    // Summary
    console.log(`\n${colors.bright}Chunking Summary:${colors.reset}`);
    console.table(results);

    return results;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    error(`Chunking test failed: ${errorMessage}`);
    throw err;
  }
}

// Test reranking behavior
async function testReranking() {
  header('Testing Reranking Behavior');

  try {
    const client = new PineconeClient({ indexName: INDEX_NAME });

    // Sample query
    const query = 'What is the main topic of discussion?';

    info(`Query: "${query}"`);

    // Get initial results
    const initialResults = await client.queryByText(query, {
      topK: 10,
      namespace: 'test',
    });

    if (initialResults.matches.length === 0) {
      warning(
        'No results found in test namespace. Please run write-pipeline first.',
      );
      return;
    }

    info(`Initial results: ${initialResults.matches.length} matches`);

    // Apply reranking
    const reranker = createReranker();
    const rerankedResults = await reranker.rerank(
      query,
      initialResults.matches,
    );

    success(`Reranked results: ${rerankedResults.length} matches`);

    // Compare top results
    console.log(`\n${colors.bright}Top 3 Results Comparison:${colors.reset}`);
    console.log('\nBefore Reranking:');
    initialResults.matches.slice(0, 3).forEach((match, i) => {
      log(
        `  ${i + 1}. Score: ${match.score.toFixed(4)} - ${match.content.substring(0, 100)}...`,
        colors.cyan,
      );
    });

    console.log('\nAfter Reranking:');
    rerankedResults.slice(0, 3).forEach((match, i) => {
      log(
        `  ${i + 1}. Score: ${match.score.toFixed(4)} - ${match.content.substring(0, 100)}...`,
        colors.green,
      );
    });

    // Check if order changed
    const orderChanged =
      initialResults.matches[0]?.id !== rerankedResults[0]?.id;
    if (orderChanged) {
      success('✓ Reranking changed the order of results');
    } else {
      info('ℹ Reranking maintained the same top result');
    }

    return {
      initialCount: initialResults.matches.length,
      rerankedCount: rerankedResults.length,
      orderChanged,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    error(`Reranking test failed: ${errorMessage}`);
    throw err;
  }
}

// Test consistency (ask same question multiple times)
async function testConsistency() {
  header('Testing Query Consistency');

  try {
    const client = new PineconeClient({ indexName: INDEX_NAME });
    const query = 'What are the key points discussed?';
    const iterations = 4;

    info(`Query: "${query}"`);
    info(`Running ${iterations} iterations...`);

    const results: ConsistencyResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const result = await client.queryByText(query, {
        topK: 5,
        namespace: 'test',
      });

      if (result.matches.length > 0) {
        results.push({
          iteration: i + 1,
          matchCount: result.matches.length,
          topScore: result.matches[0].score,
          topId: result.matches[0].id,
          topContent: result.matches[0].content.substring(0, 50),
        });
      }
    }

    // Analyze consistency
    console.log(`\n${colors.bright}Consistency Results:${colors.reset}`);
    console.table(results);

    // Check if all iterations returned the same top result
    const allSameTop = results.every((r) => r.topId === results[0].topId);
    const allSameCount = results.every(
      (r) => r.matchCount === results[0].matchCount,
    );

    if (allSameTop && allSameCount) {
      success('✓ Perfect consistency: Same results across all iterations');
    } else if (allSameTop) {
      success('✓ Good consistency: Same top result across all iterations');
    } else {
      warning('⚠ Inconsistent results detected across iterations');
    }

    // Calculate score variance
    const scores = results.map((r) => r.topScore);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) /
      scores.length;

    info(`Score variance: ${variance.toFixed(6)}`);

    return {
      consistent: allSameTop,
      avgScore,
      variance,
      iterations,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    error(`Consistency test failed: ${errorMessage}`);
    throw err;
  }
}

// Full pipeline test
async function testWritePipeline() {
  header('Testing Complete Write Pipeline');

  try {
    const client = new PineconeClient({ indexName: INDEX_NAME });

    // Load test data
    const content = loadTestFile('sample.vtt');
    const items = parseTranscript(content);

    info(`Loaded ${items.length} transcript items`);

    // Generate deterministic hash from content
    const contentHash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex');

    // Chunk the content
    const chunks = await chunkTranscriptItems(items, [], {
      model: 'claude-sonnet-4',
      dryRun: false,
    });

    info(`Generated ${chunks.length} chunks`);

    // Convert to RAG documents with deterministic IDs
    const documents: RAGDocument[] = chunks.map((chunk, index) => ({
      id: `${contentHash}-chunk-${index}`,
      content: chunk.content,
      metadata: {
        source: 'test-pipeline',
        type: 'transcript',
        topic: chunk.topic,
        speakers: chunk.metadata.speakers,
        startTime: chunk.metadata.startTime,
        endTime: chunk.metadata.endTime,
        chunkIndex: index,
        totalChunks: chunks.length,
        createdAt: new Date().toISOString(),
        fileHash: contentHash,
      },
    }));

    // Write to Pinecone
    const result = await client.writeDocuments(documents, {
      namespace: 'test',
    });

    if (result.success) {
      success(
        `✓ Successfully wrote ${result.documentsWritten} documents to namespace '${result.namespace}'`,
      );
    } else {
      error(`✗ Write failed: ${result.errors?.join(', ')}`);
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    error(`Pipeline test failed: ${errorMessage}`);
    throw err;
  }
}

// Test query operations
async function testQuery() {
  header('Testing Query Operations');

  try {
    const client = new PineconeClient({ indexName: INDEX_NAME });

    const queries = [
      { text: 'What are the top metrics for executives?', filters: undefined },
      { text: 'revenue MRR ARR growth', filters: undefined },
      { text: 'customer churn rate', filters: undefined },
      {
        text: 'dashboard requirements',
        filters: { type: 'transcript' },
      },
      {
        text: 'revenue tracking',
        filters: { topic: 'Revenue Metrics' },
      },
    ];

    const results: QueryTestResult[] = [];

    for (const query of queries) {
      info(`\nQuery: "${query.text}"`);
      if (query.filters && Object.keys(query.filters).length > 0) {
        info(`Filters: ${JSON.stringify(query.filters)}`);
      }

      const result = await client.queryByText(query.text, {
        topK: 3,
        namespace: 'test',
        filter: query.filters,
        minScore: 0.0, // No threshold for testing - show all results
      });

      success(`Found ${result.matches.length} matches`);

      result.matches.forEach((match, i) => {
        log(`  ${i + 1}. Score: ${match.score.toFixed(4)}`, colors.cyan);
        log(`     Content: ${match.content.substring(0, 100)}...`, colors.cyan);
      });

      results.push({
        query: query.text,
        matchCount: result.matches.length,
        topScore: result.matches[0]?.score || 0,
      });
    }

    // Summary
    console.log(`\n${colors.bright}Query Summary:${colors.reset}`);
    console.table(results);

    return results;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    error(`Query test failed: ${errorMessage}`);
    throw err;
  }
}

// Run all integration tests
async function runIntegrationTests() {
  header('Running All Integration Tests');

  const tests = [
    { name: 'File Loading', fn: testFileLoading },
    { name: 'Chunking', fn: testChunking },
    { name: 'Write Pipeline', fn: testWritePipeline },
    { name: 'Query Operations', fn: testQuery },
    { name: 'Reranking', fn: testReranking },
    { name: 'Consistency', fn: testConsistency },
  ];

  const results: IntegrationTestResult[] = [];

  for (const test of tests) {
    try {
      info(`\nRunning: ${test.name}`);
      await test.fn();
      success(`✓ ${test.name} completed`);
      results.push({ test: test.name, status: 'PASSED' });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      error(`✗ ${test.name} failed: ${errorMessage}`);
      results.push({ test: test.name, status: 'FAILED', error: errorMessage });
    }
  }

  // Final summary
  header('Integration Test Summary');
  console.table(results);

  const passed = results.filter((r) => r.status === 'PASSED').length;
  const failed = results.filter((r) => r.status === 'FAILED').length;

  if (failed === 0) {
    success(`\n✓ All ${passed} tests passed!`);
  } else {
    warning(`\n⚠ ${passed} passed, ${failed} failed`);
  }
}

// Main CLI handler
async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log(`
${colors.bright}RAG CLI Testing Tool${colors.reset}

Usage: pnpm rag:test <command>

Commands:
  test-write        Test the write pipeline with sample data
  test-query        Test query operations
  test-files        Test loading different file formats
  test-chunking     Test chunking behavior
  test-reranking    Test reranking functionality
  test-consistency  Test query consistency (4 iterations)
  test-pipeline     Run complete write pipeline test
  run-integration   Run all integration tests

Examples:
  pnpm rag:test test-files
  pnpm rag:test test-consistency
  pnpm rag:test run-integration
`);
    process.exit(0);
  }

  try {
    switch (command) {
      case 'test-write':
        await testWritePipeline();
        break;
      case 'test-query':
        await testQuery();
        break;
      case 'test-files':
        await testFileLoading();
        break;
      case 'test-chunking':
        await testChunking();
        break;
      case 'test-reranking':
        await testReranking();
        break;
      case 'test-consistency':
        await testConsistency();
        break;
      case 'test-pipeline':
        await testWritePipeline();
        break;
      case 'run-integration':
        await runIntegrationTests();
        break;
      default:
        error(`Unknown command: ${command}`);
        process.exit(1);
    }

    success('\n✓ Test completed successfully');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    error(`\n✗ Test failed: ${errorMessage}`);
    console.error(err);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export {
  testFileLoading,
  testChunking,
  testReranking,
  testConsistency,
  testWritePipeline,
  testQuery,
  runIntegrationTests,
};
