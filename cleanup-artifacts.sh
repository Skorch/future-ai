#!/bin/bash

# Delete artifact directories for s01 task
echo "Deleting unused artifact directories..."

# Delete code artifacts
rm -f artifacts/code/client.tsx
rm -f artifacts/code/server.ts
rmdir artifacts/code 2>/dev/null

# Delete sheet artifacts
rm -f artifacts/sheet/client.tsx
rm -f artifacts/sheet/server.ts
rmdir artifacts/sheet 2>/dev/null

# Delete image artifacts
rm -f artifacts/image/client.tsx
rmdir artifacts/image 2>/dev/null

# Delete RAG tools
rm -f lib/ai/tools/write-to-rag.ts
rm -f lib/ai/utils/content-resolver.ts

# Delete tests
rm -f __tests__/integration/rag-pipeline.test.ts
rm -f __tests__/unit/write-to-rag.test.ts

echo "Cleanup complete!"