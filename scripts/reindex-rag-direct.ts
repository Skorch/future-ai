/**
 * Re-index all documents in the RAG system with VoyageAI embeddings
 * Direct database access version - bypasses lib/db
 *
 * Usage:
 *   pnpm tsx scripts/reindex-rag-direct.ts                    # Re-index all documents
 *   pnpm tsx scripts/reindex-rag-direct.ts --workspace xyz    # Re-index specific workspace
 *   pnpm tsx scripts/reindex-rag-direct.ts --dry-run         # Test without actually indexing
 *   pnpm tsx scripts/reindex-rag-direct.ts --document abc    # Re-index specific document
 */

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import path from 'node:path';

// Load environment variables first - try multiple locations
config({ path: path.join(process.cwd(), '.env.local') });
config({ path: path.join(process.cwd(), '.env') });

// Direct database connection
const connectionString = process.env.POSTGRES_URL;
if (!connectionString) {
  console.error('❌ POSTGRES_URL environment variable is not set');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

interface ReindexOptions {
  workspaceId?: string;
  documentId?: string;
  dryRun?: boolean;
  clearFirst?: boolean;
}

interface DocumentMetadata {
  documentType?: string;
  fileName?: string;
  fileSize?: number;
  uploadedAt?: string;
  meetingDate?: string;
  participants?: string[];
  title?: string;
  workspaceId?: string;
  createdAt?: string | Date;
  [key: string]: unknown;
}

interface Document {
  id: string;
  title: string;
  workspaceId: string;
  metadata: DocumentMetadata;
  content: string;
  contentLength: number;
  createdAt: Date;
}

async function getDocuments(options: ReindexOptions): Promise<Document[]> {
  const conditions: string[] = ['content IS NOT NULL'];

  if (options.workspaceId) {
    conditions.push(`"workspaceId" = '${options.workspaceId}'`);
  }

  if (options.documentId) {
    conditions.push(`id = '${options.documentId}'`);
  }

  const query = `
    SELECT
      id,
      title,
      "workspaceId",
      metadata,
      content,
      LENGTH(content) as "contentLength",
      "createdAt"
    FROM "Document"
    WHERE ${conditions.join(' AND ')}
    ORDER BY "createdAt" DESC
  `;

  const result = await db.execute(sql.raw(query));
  return result as Document[];
}

async function testVoyageAI() {
  console.log('\n📡 Testing VoyageAI connection...');

  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        input: 'test connection',
        model: 'voyage-3-large',
        input_type: 'query',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log('✅ VoyageAI connected successfully');
    console.log(`   Model: voyage-3-large`);
    console.log(
      `   Embedding dimensions: ${data.data[0]?.embedding?.length || 0}`,
    );
    return true;
  } catch (error) {
    console.error('❌ VoyageAI connection failed:', error);
    return false;
  }
}

async function generateEmbeddings(
  texts: string[],
  inputType: 'document' | 'query' = 'document',
) {
  const response = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: 'voyage-3-large',
      input_type: inputType,
      truncation: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`VoyageAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Sort by index to maintain order
  interface EmbeddingItem {
    index: number;
    embedding: number[];
  }

  return data.data
    .sort((a: EmbeddingItem, b: EmbeddingItem) => a.index - b.index)
    .map((item: EmbeddingItem) => item.embedding);
}

interface PineconeVector {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

// Simple direct Pinecone client
class DirectPineconeClient {
  private apiKey: string;
  private indexName: string;
  private baseUrl = 'https://api.pinecone.io';

  constructor() {
    this.apiKey = process.env.PINECONE_API_KEY || '';
    this.indexName = process.env.PINECONE_INDEX_NAME || 'rag-agent-poc';

    if (!this.apiKey) {
      throw new Error('PINECONE_API_KEY is required');
    }
  }

  async getIndexHost(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/indexes/${this.indexName}`, {
      headers: {
        'Api-Key': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get index info: ${response.statusText}`);
    }

    const data = await response.json();
    return data.host;
  }

  async upsertVectors(
    host: string,
    namespace: string,
    vectors: PineconeVector[],
  ) {
    const response = await fetch(`https://${host}/vectors/upsert`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        namespace,
        vectors,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pinecone upsert failed: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async deleteByMetadata(
    host: string,
    namespace: string,
    filter: Record<string, unknown>,
  ) {
    const response = await fetch(`https://${host}/vectors/delete`, {
      method: 'POST',
      headers: {
        'Api-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        namespace,
        filter,
      }),
    });

    if (!response.ok && !response.status.toString().startsWith('404')) {
      const error = await response.text();
      console.warn(`Pinecone delete warning: ${response.status} - ${error}`);
    }
  }
}

// Simple chunking function
function chunkDocument(
  content: string,
  documentId: string,
  metadata: DocumentMetadata,
) {
  const sections = content.split(/\n\n+/).filter((s) => s.trim().length > 100);

  return sections.map((section, index) => ({
    id: `${documentId}-chunk-${index}`,
    text: section,
    metadata: {
      documentId,
      documentType: metadata?.documentType || 'document',
      title: metadata?.title,
      chunkIndex: index,
      totalChunks: sections.length,
      workspaceId: metadata?.workspaceId,
      createdAt: metadata?.createdAt,
    },
  }));
}

async function reindexDocument(
  doc: Document,
  pinecone: DirectPineconeClient,
  host: string,
  options: ReindexOptions,
) {
  const metadata = doc.metadata || {};
  const documentType = metadata.documentType || 'unknown';
  const sizeKB = Math.round(doc.contentLength / 1024);

  console.log(`\n   📄 ${doc.title}`);
  console.log(`      ID: ${doc.id}`);
  console.log(`      Type: ${documentType}`);
  console.log(`      Size: ${sizeKB} KB`);
  console.log(`      Created: ${new Date(doc.createdAt).toLocaleDateString()}`);

  if (!metadata.documentType) {
    console.log(
      `      ⚠️  WARNING: No documentType in metadata - will use default chunking`,
    );
  }

  if (options.dryRun) {
    console.log(`      [DRY RUN] Would re-index this document`);
    return 'success';
  }

  try {
    console.log(`      ⏳ Generating chunks...`);

    // Delete existing chunks
    await pinecone.deleteByMetadata(host, doc.workspaceId, {
      documentId: { $eq: doc.id },
    });

    // Chunk the document
    const chunks = chunkDocument(doc.content, doc.id, {
      ...metadata,
      workspaceId: doc.workspaceId,
      title: doc.title,
      createdAt: doc.createdAt,
    });

    console.log(`      📦 Generated ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.log(`      ⏭️  No chunks to index`);
      return 'skipped';
    }

    // Generate embeddings for all chunks
    console.log(`      🧮 Generating embeddings with VoyageAI...`);
    const texts = chunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts, 'document');

    // Prepare vectors for Pinecone
    const vectors = chunks.map((chunk, i) => ({
      id: chunk.id,
      values: embeddings[i],
      metadata: {
        ...chunk.metadata,
        content: chunk.text, // Store content for retrieval
      },
    }));

    // Upsert to Pinecone
    console.log(`      📤 Uploading to Pinecone...`);
    await pinecone.upsertVectors(host, doc.workspaceId, vectors);

    console.log(`      ✅ Successfully indexed ${vectors.length} chunks`);
    return 'success';
  } catch (error) {
    console.error(
      `      ❌ Failed to index:`,
      error instanceof Error ? error.message : error,
    );
    return 'failed';
  }
}

async function main() {
  console.log('🚀 RAG Re-indexing Tool (Direct Version)');
  console.log('═'.repeat(50));

  // Parse command line arguments
  const args = process.argv.slice(2);
  const options: ReindexOptions = {
    workspaceId:
      args.find((a) => a.startsWith('--workspace='))?.split('=')[1] ||
      (args.includes('--workspace')
        ? args[args.indexOf('--workspace') + 1]
        : undefined),
    documentId:
      args.find((a) => a.startsWith('--document='))?.split('=')[1] ||
      (args.includes('--document')
        ? args[args.indexOf('--document') + 1]
        : undefined),
    dryRun: args.includes('--dry-run'),
  };

  if (args.includes('--help') || args.includes('-h')) {
    console.log('\nUsage:');
    console.log('  pnpm tsx scripts/reindex-rag-direct.ts [options]');
    console.log('\nOptions:');
    console.log('  --workspace <id>  Re-index specific workspace');
    console.log('  --document <id>   Re-index specific document');
    console.log('  --dry-run         Test without actual indexing');
    console.log('  --help            Show this help message');
    process.exit(0);
  }

  console.log('\nConfiguration:');
  console.log(
    `  Pinecone Index: ${process.env.PINECONE_INDEX_NAME || 'rag-agent-poc'}`,
  );
  console.log(`  VoyageAI Model: voyage-3-large`);

  if (options.workspaceId) {
    console.log(`  Filter: Workspace ${options.workspaceId}`);
  }
  if (options.documentId) {
    console.log(`  Filter: Document ${options.documentId}`);
  }
  if (options.dryRun) {
    console.log(`  Mode: DRY RUN (no actual changes)`);
  }

  // Test connections
  const voyageOk = await testVoyageAI();
  if (!voyageOk) {
    console.error('\n❌ Cannot proceed without VoyageAI connection');
    process.exit(1);
  }

  // Initialize Pinecone
  let pinecone: DirectPineconeClient;
  let pineconeHost: string;

  try {
    pinecone = new DirectPineconeClient();
    pineconeHost = await pinecone.getIndexHost();
    console.log('✅ Pinecone connected successfully');
    console.log(`   Host: ${pineconeHost}`);
  } catch (error) {
    console.error('❌ Pinecone connection failed:', error);
    process.exit(1);
  }

  // Get documents
  console.log('\n🔍 Finding documents to re-index...');
  const documents = await getDocuments(options);

  if (documents.length === 0) {
    console.log('No documents found to re-index');
    await client.end();
    process.exit(0);
  }

  console.log(`Found ${documents.length} documents to re-index`);

  // Group by workspace
  const workspaces = new Map<string, Document[]>();
  for (const doc of documents) {
    const ws = doc.workspaceId;
    if (!workspaces.has(ws)) {
      workspaces.set(ws, []);
    }
    workspaces.get(ws)?.push(doc);
  }

  console.log(`Across ${workspaces.size} workspace(s)`);

  // Re-index documents
  console.log('\n📥 Starting re-indexing...');
  console.log('─'.repeat(50));

  let totalSuccess = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const [workspaceId, workspaceDocs] of workspaces) {
    console.log(`\n📁 Workspace: ${workspaceId}`);
    console.log(`   Documents: ${workspaceDocs.length}`);

    for (const doc of workspaceDocs) {
      const result = await reindexDocument(
        doc,
        pinecone,
        pineconeHost,
        options,
      );

      switch (result) {
        case 'success':
          totalSuccess++;
          break;
        case 'failed':
          totalFailed++;
          break;
        case 'skipped':
          totalSkipped++;
          break;
      }
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(50)}`);
  console.log('📊 Re-indexing Summary:');
  console.log('─'.repeat(50));
  console.log(`   ✅ Success: ${totalSuccess} documents`);
  console.log(`   ❌ Failed: ${totalFailed} documents`);
  console.log(`   ⏭️  Skipped: ${totalSkipped} documents`);
  console.log(`   📝 Total: ${documents.length} documents`);

  if (options.dryRun) {
    console.log('\n⚠️  This was a dry run - no actual changes were made');
    console.log('Remove --dry-run flag to perform actual re-indexing');
  }

  console.log('\n✨ Done!');

  // Clean up database connection
  await client.end();
  process.exit(0);
}

// Run the script
main().catch(async (error) => {
  console.error('❌ Fatal error:', error);
  await client.end();
  process.exit(1);
});
