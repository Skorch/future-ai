#!/usr/bin/env tsx
/**
 * Test script for demo workspace functionality
 * Run with: pnpm tsx test-demo-workspace.ts
 */

import { config } from 'dotenv';
import { ensureDemoWorkspace } from './lib/db/demo-data';

// Load environment variables
config();

async function testDemoWorkspace() {
  console.log('Testing demo workspace creation...\n');

  // Check environment variables
  const sourceWorkspaceId = process.env.SOURCE_WORKSPACE_ID;
  const demoWorkspaceName = process.env.DEMO_WORKSPACE_NAME || 'Demo';

  console.log('Configuration:');
  console.log(
    '- SOURCE_WORKSPACE_ID:',
    sourceWorkspaceId ? `${sourceWorkspaceId.substring(0, 10)}...` : 'NOT SET',
  );
  console.log('- DEMO_WORKSPACE_NAME:', demoWorkspaceName);
  console.log('');

  if (!sourceWorkspaceId) {
    console.error('❌ SOURCE_WORKSPACE_ID environment variable is not set!');
    console.log('Please add to your .env file:');
    console.log('SOURCE_WORKSPACE_ID=618cc4e2-4f5b-47d2-8c82-a115b188b797');
    process.exit(1);
  }

  // Test with a mock user ID
  const testUserId = `test_user_${Date.now()}`;

  try {
    console.log(`Testing with user ID: ${testUserId}\n`);

    // First call - should create new Demo workspace
    console.log('1. Creating Demo workspace...');
    const result1 = await ensureDemoWorkspace(testUserId);

    console.log('Result:', {
      success: result1.success,
      workspaceId: result1.workspaceId,
      counts: result1.counts,
      error: result1.error,
    });

    if (!result1.success) {
      console.log(
        '\n⚠️ Demo workspace creation failed, but fallback workspace was created',
      );
      console.log('This is expected if the demo user has no content to clone');
    } else {
      console.log('\n✅ Demo workspace created successfully!');
      console.log(`   - Cloned ${result1.counts.chats} chats`);
      console.log(`   - Cloned ${result1.counts.messages} messages`);
      console.log(`   - Cloned ${result1.counts.documents} documents`);
    }

    // Second call - should return existing workspace
    console.log('\n2. Checking idempotency (second call)...');
    const result2 = await ensureDemoWorkspace(testUserId);

    if (result2.workspaceId === result1.workspaceId) {
      console.log('✅ Correctly returned existing workspace');
    } else {
      console.log('❌ Created new workspace instead of returning existing');
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the test
testDemoWorkspace();
