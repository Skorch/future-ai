#!/usr/bin/env tsx
import { Pinecone } from '@pinecone-database/pinecone';
import * as dotenv from 'dotenv';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

// Load environment variables
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Configuration
const INDEX_NAME = 'rag-agent-poc';
const DIMENSION = 1024; // llama-text-embed-v2 dimension
const METRIC = 'cosine';
const EMBEDDING_MODEL = 'llama-text-embed-v2';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

async function validateEnvironment() {
  log('\n📋 Validating environment...', colors.bright);

  const apiKey = process.env.PINECONE_API_KEY;
  if (!apiKey) {
    error('PINECONE_API_KEY is not set in environment variables');
    info('Please add PINECONE_API_KEY to your .env.local file');
    process.exit(1);
  }

  success('PINECONE_API_KEY found');
  return apiKey;
}

async function initializePinecone(apiKey: string) {
  try {
    const pinecone = new Pinecone({
      apiKey,
    });
    success('Pinecone client initialized');
    return pinecone;
  } catch (err) {
    error(`Failed to initialize Pinecone: ${err}`);
    process.exit(1);
  }
}

async function checkIndexExists(pinecone: Pinecone, indexName: string) {
  try {
    const indexes = await pinecone.listIndexes();
    const indexNames = indexes.indexes?.map((idx) => idx.name) || [];
    return indexNames.includes(indexName);
  } catch (err) {
    error(`Failed to list indexes: ${err}`);
    return false;
  }
}

async function createIndex(pinecone: Pinecone) {
  log(
    `\n🚀 Creating index '${INDEX_NAME}' with integrated embeddings...`,
    colors.bright,
  );

  try {
    // Use createIndexForModel for integrated embeddings
    await pinecone.createIndexForModel({
      name: INDEX_NAME,
      cloud: 'aws',
      region: 'us-east-1',
      embed: {
        model: EMBEDDING_MODEL,
        fieldMap: {
          text: 'content', // Map 'content' field to text for embedding
        },
      },
    });

    success(
      `Index '${INDEX_NAME}' created successfully with integrated embeddings`,
    );
    info(`Embedding Model: ${EMBEDDING_MODEL} (${DIMENSION} dimensions)`);
    info(`Metric: ${METRIC}`);
    info(`Field Mapping: content → text`);
    info(`Type: Serverless (AWS us-east-1)`);
  } catch (err) {
    const errorObj = err as Error;
    if (errorObj.message?.includes('already exists')) {
      warning(`Index '${INDEX_NAME}' already exists`);
    } else {
      error(`Failed to create index: ${err}`);
      process.exit(1);
    }
  }
}

async function deleteIndex(pinecone: Pinecone) {
  log(`\n🗑️  Deleting index '${INDEX_NAME}'...`, colors.bright);

  try {
    await pinecone.deleteIndex(INDEX_NAME);
    success(`Index '${INDEX_NAME}' deleted successfully`);
  } catch (err) {
    const errorObj = err as Error;
    if (errorObj.message?.includes('not found')) {
      warning(`Index '${INDEX_NAME}' does not exist`);
    } else {
      error(`Failed to delete index: ${err}`);
      process.exit(1);
    }
  }
}

async function getIndexStats(pinecone: Pinecone) {
  log(`\n📊 Getting index statistics for '${INDEX_NAME}'...`, colors.bright);

  try {
    const index = pinecone.index(INDEX_NAME);
    const stats = await index.describeIndexStats();

    success('Index statistics retrieved');
    info(`Total vectors: ${stats.totalRecordCount || 0}`);
    info(`Dimension: ${stats.dimension || DIMENSION}`);
    info(`Index fullness: ${((stats.indexFullness || 0) * 100).toFixed(2)}%`);

    if (stats.namespaces) {
      const namespaceList = Object.keys(stats.namespaces);
      if (namespaceList.length > 0) {
        info(`Namespaces: ${namespaceList.join(', ')}`);
        for (const [name, ns] of Object.entries(stats.namespaces)) {
          info(`  - ${name}: ${ns.recordCount} vectors`);
        }
      } else {
        info('No namespaces found');
      }
    }
  } catch (err) {
    error(`Failed to get index stats: ${err}`);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  log('\n🔧 Pinecone Setup Script', colors.bright + colors.cyan);
  log('='.repeat(50), colors.cyan);

  const apiKey = await validateEnvironment();
  const pinecone = await initializePinecone(apiKey);

  switch (command) {
    case 'create':
    case 'create-index': {
      const exists = await checkIndexExists(pinecone, INDEX_NAME);
      if (exists) {
        warning(`Index '${INDEX_NAME}' already exists`);
        await getIndexStats(pinecone);
      } else {
        await createIndex(pinecone);
      }
      break;
    }

    case 'delete':
    case 'delete-index':
      await deleteIndex(pinecone);
      break;

    case 'reset':
    case 'reset-index':
      await deleteIndex(pinecone);
      await createIndex(pinecone);
      break;

    case 'stats':
    case 'status':
      await getIndexStats(pinecone);
      break;

    case 'list':
    case 'list-indexes': {
      log('\n📋 Listing all indexes...', colors.bright);
      const indexes = await pinecone.listIndexes();
      if (indexes.indexes && indexes.indexes.length > 0) {
        success(`Found ${indexes.indexes.length} index(es):`);
        for (const idx of indexes.indexes) {
          const isCurrent = idx.name === INDEX_NAME;
          const marker = isCurrent ? ' (current)' : '';
          info(`  - ${idx.name}${marker}`);
        }
      } else {
        warning('No indexes found');
      }
      break;
    }

    default:
      log('\n📖 Usage:', colors.bright);
      info('  pnpm pinecone:setup create-index  - Create the RAG index');
      info('  pnpm pinecone:setup delete-index  - Delete the RAG index');
      info(
        '  pnpm pinecone:setup reset-index   - Reset (delete and recreate) the index',
      );
      info('  pnpm pinecone:setup stats         - Show index statistics');
      info('  pnpm pinecone:setup list-indexes  - List all indexes');

      if (command) {
        error(`Unknown command: ${command}`);
        process.exit(1);
      }
  }

  log('\n✨ Done!', colors.green + colors.bright);
}

// Run the script
main().catch((err) => {
  error(`Unexpected error: ${err}`);
  process.exit(1);
});
