#!/usr/bin/env tsx

import { config } from 'dotenv';
import { saveDocument } from '@/lib/db/documents';
import { generateUUID } from '@/lib/utils';

config();

async function testRAGIndexing() {
  console.log('=== Testing RAG Indexing ===\n');

  // Test parameters
  const testDocumentId = generateUUID();
  const testWorkspaceId = `test-workspace-${generateUUID()}`;
  const testUserId = `test-user-${generateUUID()}`;

  console.log('Test Configuration:');
  console.log('- Document ID:', testDocumentId);
  console.log('- Workspace ID:', testWorkspaceId);
  console.log('- User ID:', testUserId);
  console.log('\n');

  try {
    console.log('Creating test document with proper metadata...');

    const result = await saveDocument({
      id: testDocumentId,
      title: 'Test Document for RAG Indexing',
      content: `This is a test document created to verify RAG indexing.

Meeting Notes:
- Testing the automatic RAG synchronization
- Verifying that workspaceId is passed correctly
- Ensuring proper error logging

Action Items:
- Verify document appears in Pinecone
- Check namespace matches workspaceId
- Confirm chunks are created

Summary:
This test verifies that documents are automatically indexed in the RAG system when created through the saveDocument function.`,
      kind: 'text',
      userId: testUserId,
      workspaceId: testWorkspaceId,
      metadata: {
        documentType: 'document',
        testRun: true,
        timestamp: new Date().toISOString(),
      },
    });

    console.log('\nDocument saved successfully!');
    console.log('Result:', result);
    console.log('\n');
    console.log('✅ Test completed! Check the logs above for:');
    console.log('   - [saveDocument] Starting RAG sync');
    console.log('   - [RAG Sync] Starting document sync');
    console.log('   - [RAG Sync] SUCCESS: Stored X chunks');
    console.log('\n');
    console.log(
      'If you see these logs with the correct workspaceId, the fix is working!',
    );
    console.log(
      'If you see error logs, the issue details will be shown above.',
    );
  } catch (error) {
    console.error('❌ Test failed:', error);
  }

  process.exit(0);
}

// Run the test
testRAGIndexing().catch(console.error);
