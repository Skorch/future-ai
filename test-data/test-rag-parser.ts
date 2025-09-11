import {
  parseTranscript,
  parseDocument,
} from '../lib/ai/utils/transcript-parser.js';
import { chunkTranscriptItems } from '../lib/ai/utils/rag-chunker.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

async function testParser() {
  console.log('Testing RAG Parser Implementation\n');
  console.log('='.repeat(50));

  // Test WebVTT parsing
  console.log('\n1. Testing WebVTT Parser:');
  try {
    const webvttContent = readFileSync(
      join(__dirname, 'sample-zoom.vtt'),
      'utf-8',
    );
    const webvttItems = parseTranscript(webvttContent);
    console.log(`   ✓ Parsed ${webvttItems.length} items from WebVTT`);
    console.log(
      `   First item: ${webvttItems[0].speaker} at ${webvttItems[0].timecode}s`,
    );
  } catch (error) {
    console.error(`   ✗ WebVTT parsing failed:`, error);
  }

  // Test Fathom parsing
  console.log('\n2. Testing Fathom Parser:');
  try {
    const fathomContent = readFileSync(
      join(__dirname, 'sample-fathom.txt'),
      'utf-8',
    );
    const fathomItems = parseTranscript(fathomContent);
    console.log(`   ✓ Parsed ${fathomItems.length} items from Fathom`);
    console.log(
      `   First item: ${fathomItems[0].speaker} at ${fathomItems[0].timecode}s`,
    );
  } catch (error) {
    console.error(`   ✗ Fathom parsing failed:`, error);
  }

  // Test Document parsing
  console.log('\n3. Testing Document Parser:');
  try {
    const docContent = readFileSync(
      join(__dirname, 'sample-document.md'),
      'utf-8',
    );
    const docItems = parseDocument(docContent);
    console.log(`   ✓ Parsed ${docItems.length} sections from document`);
    console.log(`   First section length: ${docItems[0].text.length} chars`);
  } catch (error) {
    console.error(`   ✗ Document parsing failed:`, error);
  }

  // Test RAG Chunker with dry run
  console.log('\n4. Testing RAG Chunker (dry run):');
  try {
    const webvttContent = readFileSync(
      join(__dirname, 'sample-zoom.vtt'),
      'utf-8',
    );
    const items = parseTranscript(webvttContent);
    const chunks = await chunkTranscriptItems(
      items,
      ['Planning', 'Budget', 'Technical'],
      { dryRun: true, chunkSize: 5 },
    );
    console.log(`   ✓ Created ${chunks.length} chunks`);
    console.log(
      `   Topics: ${[...new Set(chunks.map((c) => c.topic))].join(', ')}`,
    );
  } catch (error) {
    console.error(`   ✗ Chunking failed:`, error);
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log('Testing complete!');
}

testParser().catch(console.error);
