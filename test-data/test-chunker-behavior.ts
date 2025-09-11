import { chunkTranscriptItems } from '../lib/ai/utils/rag-chunker.js';
import type { TranscriptItem } from '../lib/rag/types.js';

// Create a test conversation that should have natural topic boundaries
const testConversation: TranscriptItem[] = [
  // Budget discussion (items 0-3)
  {
    timecode: 0,
    speaker: 'Alice',
    text: "Let's start with the Q2 budget review",
  },
  { timecode: 10, speaker: 'Bob', text: 'Marketing went over budget by 15%' },
  {
    timecode: 20,
    speaker: 'Alice',
    text: 'We need to reduce costs next quarter',
  },
  { timecode: 30, speaker: 'Bob', text: 'I agree, we should be more careful' },

  // Product discussion (items 4-7)
  {
    timecode: 40,
    speaker: 'Alice',
    text: 'Moving on to the new feature launch',
  },
  {
    timecode: 50,
    speaker: 'Bob',
    text: 'The authentication system is ready for testing',
  },
  {
    timecode: 60,
    speaker: 'Alice',
    text: 'Great! What about the UI components?',
  },
  {
    timecode: 70,
    speaker: 'Bob',
    text: 'UI is 80% complete, should be done this week',
  },

  // Back to budget (items 8-10)
  {
    timecode: 80,
    speaker: 'Alice',
    text: 'Going back to the budget topic - what about engineering costs?',
  },
  {
    timecode: 90,
    speaker: 'Bob',
    text: 'Engineering stayed within budget actually',
  },
  { timecode: 100, speaker: 'Alice', text: "That's good news at least" },

  // Team discussion (items 11-13)
  { timecode: 110, speaker: 'Bob', text: "Let's discuss team expansion plans" },
  { timecode: 120, speaker: 'Alice', text: 'We have approval for 2 new hires' },
  {
    timecode: 130,
    speaker: 'Bob',
    text: 'I think we should focus on senior developers',
  },
];

async function testChunkingBehavior() {
  console.log('Testing RAG Chunker Topic-Based Segmentation\n');
  console.log('='.repeat(60));

  const topics = ['Budget', 'Product Development', 'Team', 'Operations'];

  // Test 1: Dry run mode (should use intelligent fallback)
  console.log('\n1. Testing with Dry Run (Fallback Logic):');
  console.log('-'.repeat(40));

  try {
    const dryRunChunks = await chunkTranscriptItems(testConversation, topics, {
      dryRun: true,
      chunkSize: 200,
    });

    console.log(`✓ Created ${dryRunChunks.length} chunks\n`);

    dryRunChunks.forEach((chunk, i) => {
      const itemCount = chunk.endIdx - chunk.startIdx + 1;
      console.log(`  Chunk ${i + 1}:`);
      console.log(`    Topic: ${chunk.topic}`);
      console.log(
        `    Items: ${chunk.startIdx}-${chunk.endIdx} (${itemCount} items)`,
      );
      console.log(
        `    Time: ${chunk.metadata.startTime}s - ${chunk.metadata.endTime}s`,
      );
      console.log(`    Speakers: ${chunk.metadata.speakers.join(', ')}`);
    });

    // Validate contiguity
    let isContiguous = true;
    for (let i = 1; i < dryRunChunks.length; i++) {
      if (dryRunChunks[i].startIdx !== dryRunChunks[i - 1].endIdx + 1) {
        isContiguous = false;
        console.log(`\n  ⚠️ Gap detected between chunks ${i - 1} and ${i}`);
      }
    }

    if (
      isContiguous &&
      dryRunChunks[0].startIdx === 0 &&
      dryRunChunks[dryRunChunks.length - 1].endIdx ===
        testConversation.length - 1
    ) {
      console.log('\n  ✅ Chunks are contiguous with no gaps!');
    } else {
      console.log('\n  ❌ Contiguity validation failed!');
    }
  } catch (error) {
    console.error('✗ Dry run chunking failed:', error);
  }

  // Test 2: Small conversation (process in single window)
  console.log('\n2. Testing Small Conversation (Single Window):');
  console.log('-'.repeat(40));

  const smallConversation = testConversation.slice(0, 8);

  try {
    const smallChunks = await chunkTranscriptItems(smallConversation, topics, {
      dryRun: true,
      chunkSize: 200,
    });

    console.log(
      `✓ Created ${smallChunks.length} chunks from ${smallConversation.length} items\n`,
    );

    smallChunks.forEach((chunk, i) => {
      const preview = smallConversation
        .slice(chunk.startIdx, chunk.startIdx + 1)
        .map((item) => item.text)
        .join('');
      console.log(
        `  Chunk ${i + 1}: ${chunk.topic} (items ${chunk.startIdx}-${chunk.endIdx})`,
      );
      console.log(`    First line: "${preview.substring(0, 50)}..."`);
    });
  } catch (error) {
    console.error('✗ Small conversation chunking failed:', error);
  }

  // Test 3: Topic repetition detection
  console.log('\n3. Testing Topic Repetition (A→B→A pattern):');
  console.log('-'.repeat(40));

  const budgetItems = testConversation.filter(
    (_, i) => i <= 3 || (i >= 8 && i <= 10),
  );

  console.log('Conversation structure:');
  console.log('  Items 0-3: Budget discussion');
  console.log('  Items 4-7: Product discussion');
  console.log('  Items 8-10: Back to Budget');
  console.log('  Items 11-13: Team discussion');

  console.log('\nExpected: Budget topic should appear in 2 separate chunks');

  const chunksWithRepetition = await chunkTranscriptItems(
    testConversation,
    topics,
    { dryRun: true },
  );

  const budgetChunks = chunksWithRepetition.filter((c) => c.topic === 'Budget');
  console.log(`\n✓ Found ${budgetChunks.length} Budget chunks`);

  if (budgetChunks.length >= 2) {
    console.log('  ✅ Correctly identified topic repetition!');
  } else {
    console.log('  ⚠️ May not have detected topic repetition');
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Chunking behavior test complete!');
}

testChunkingBehavior().catch(console.error);
