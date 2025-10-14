# Artifact System Hardcoding Catalog

## Root Cause
The artifact system conflates **artifact kind** (the type identifier like 'text', 'knowledge') with **artifact definition** (the React component and behavior). This causes failures when:
- Multiple kinds want to share the same component (`textArtifact`)
- Components need to find definitions by kind
- Routes need to be determined based on kind

## Hardcoded Locations

### 1. **components/artifact.tsx**

**Line 36-43: clientArtifactRegistry**
```typescript
const clientArtifactRegistry = {
  text: textArtifact,
  knowledge: textArtifact, // ❌ Both map to same object with kind: 'text'
} as const;

export const artifactDefinitions = Object.values(clientArtifactRegistry);
// ❌ Returns [textArtifact] (single unique object), not separate definitions for each kind
```

**Line 108: Fetch URL hardcoded**
```typescript
const fetchUrl =
  shouldFetchDocument && workspaceId
    ? `/api/workspace/${workspaceId}/document/${artifact.documentId}` // ❌ Hardcoded route
    : null;
```

**Line 224-240: Save URL switch based on kind**
```typescript
switch (artifact.kind) {
  case 'knowledge':
    saveUrl = `/api/workspace/${workspaceId}/knowledge/${artifact.documentId}`; // ❌ Hardcoded
    break;
  default:
    saveUrl = `/api/workspace/${workspaceId}/document/${artifact.documentId}/content`; // ❌ Hardcoded
}
```

**Line 350-357: Artifact definition lookup**
```typescript
const artifactDefinition =
  clientArtifactRegistry[
    artifact.kind as keyof typeof clientArtifactRegistry
  ];

if (!artifactDefinition) {
  throw new Error(`Artifact definition not found for kind: ${artifact.kind}`);
}
```

### 2. **components/artifact-actions.tsx**

**Line 30-36: Definition lookup by kind**
```typescript
const artifactDefinition = artifactDefinitions.find(
  (definition) => definition.kind === artifact.kind, // ❌ Looks for definition.kind === 'knowledge'
);

if (!artifactDefinition) {
  throw new Error('Artifact definition not found!'); // ❌ Fails because textArtifact.kind === 'text'
}
```

### 3. **lib/artifacts/document-types/text/client.tsx**

**Line 16-17: Kind hardcoded in definition**
```typescript
export const textArtifact = new Artifact<'text', TextArtifactMetadata>({
  kind: 'text', // ❌ Hardcoded - can't be reused for 'knowledge' kind
  description: 'Useful for text content...',
  // ...
});
```

### 4. **components/document-preview.tsx**

**Line 41-44: Fetch URL hardcoded**
```typescript
const { data: documents, isLoading: isDocumentsFetching } = useSWR<
  Array<Document>
>(
  result && workspaceId
    ? `/api/workspace/${workspaceId}/document/${result.id}` // ❌ Hardcoded route
    : null,
  fetcher,
);
```

### 5. **lib/cache/document-cache.ts**

**Line 15-19: Cache keys hardcoded**
```typescript
return {
  versions: `/api/workspace/${workspaceId}/document/${documentEnvelopeId}`, // ❌ Hardcoded
  list: `/api/workspace/${workspaceId}/document`, // ❌ Hardcoded
  history: `/api/workspace/${workspaceId}/history`, // ❌ Hardcoded
};
```

## Impact

**Current Issues:**
1. ✅ 'text' artifacts work (kind matches definition.kind)
2. ❌ 'knowledge' artifacts fail (kind !== definition.kind)
3. ❌ Cannot add new artifact types without modifying multiple components
4. ❌ Routes are duplicated across components
5. ❌ Testing requires mocking multiple hardcoded strings

## Proposed Solution

Create a **centralized artifact registry** that:
- Maps artifact kinds → component definitions
- Maps artifact kinds → API routes (GET, PATCH, etc.)
- Provides helper functions for URL construction
- Makes components agnostic to routes
- Allows easy addition of new artifact types

### Architecture

```
lib/artifacts/artifact-registry.ts
  ├─ ArtifactRegistry class
  │   ├─ Maps kinds to configs
  │   ├─ Provides URL helpers
  │   └─ Provides component lookup
  │
  └─ Pre-configured registry export
      ├─ 'text' → textArtifact + objective routes
      └─ 'knowledge' → textArtifact + knowledge routes
```

### Benefits
- ✅ Single source of truth for artifact configurations
- ✅ Components become route-agnostic
- ✅ Easy to add new artifact types
- ✅ Type-safe with TypeScript
- ✅ Testable with mocks
- ✅ No duplicate route strings
