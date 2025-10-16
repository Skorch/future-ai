# Prompt Builder Test Suite

## Overview

This test suite validates the prompt builder system introduced in Phase 1 of the consolidation effort. The tests focus on **composition correctness** rather than exact prompt matching, following the principle that business logic (factory selection, builder composition) deserves testing while string concatenation and TypeScript type safety do not.

## Test Coverage Summary

### Total Test Count: 56 tests across 6 test files

### Factory Tests (8 tests)

#### `agent-builder-factory.test.ts` (4 tests)
- ✅ Returns correct builder instance for 'discovery' mode
- ✅ Returns correct builder instance for 'build' mode
- ✅ Throws descriptive error for invalid mode
- ✅ Verifies builders implement AgentBuilder interface

#### `document-builder-factory.test.ts` (4 tests)
- ✅ Returns correct builder instance for 'sales-strategy' type
- ✅ Returns correct builder instance for 'business-requirements' type
- ✅ Throws descriptive error for invalid document type
- ✅ Verifies builders implement DocumentBuilder interface

### Agent Builder Tests (22 tests)

#### `discovery-agent-builder.test.ts` (11 tests)
- ✅ Returns non-empty string
- ✅ Includes discovery mode identifier
- ✅ Includes system prompt header
- ✅ Includes workspace context when provided
- ✅ Includes objective context when provided
- ✅ Includes both contexts when both provided
- ✅ Handles null workspace gracefully
- ✅ Handles null objective gracefully
- ✅ Handles workspace with null context
- ✅ Handles objective with null context
- ✅ Does not include build mode content

#### `build-agent-builder.test.ts` (11 tests)
- ✅ Returns non-empty string
- ✅ Includes build mode identifier
- ✅ Includes system prompt header
- ✅ Includes workspace context when provided
- ✅ Includes objective context when provided
- ✅ Includes both contexts when both provided
- ✅ Handles null workspace gracefully
- ✅ Handles null objective gracefully
- ✅ Handles workspace with null context
- ✅ Handles objective with null context
- ✅ Does not include discovery mode content

### Document Builder Tests (26 tests)

#### `sales-strategy-builder.test.ts` (13 tests)
- ✅ Returns non-empty string
- ✅ Includes sales strategy prompt content
- ✅ Includes required output format section
- ✅ Includes sales strategy template
- ✅ Includes workspace context when provided
- ✅ Includes objective context when provided
- ✅ Includes both contexts when both provided
- ✅ Handles null workspace gracefully
- ✅ Handles null objective gracefully
- ✅ Handles workspace with null context
- ✅ Handles objective with null context
- ✅ Does not include BRD-specific content
- ✅ Includes all sections in correct order

#### `business-requirements-builder.test.ts` (13 tests)
- ✅ Returns non-empty string
- ✅ Includes BRD prompt content
- ✅ Includes required output format section
- ✅ Includes BRD template
- ✅ Includes workspace context when provided
- ✅ Includes objective context when provided
- ✅ Includes both contexts when both provided
- ✅ Handles null workspace gracefully
- ✅ Handles null objective gracefully
- ✅ Handles workspace with null context
- ✅ Handles objective with null context
- ✅ Does not include sales strategy-specific content
- ✅ Includes all sections in correct order

## Testing Philosophy

### What We Test (High-Value)

1. **Factory Selection Logic** - Ensures the right builder is returned for each mode/type
2. **Error Handling** - Validates descriptive errors for invalid inputs
3. **Composition Correctness** - Verifies all required sections are included
4. **Context Handling** - Tests null/undefined workspace and objective handling
5. **Section Ordering** - Confirms sections appear in the correct sequence
6. **Mode/Type Isolation** - Ensures builders don't mix content from other types

### What We Don't Test (Out of Scope)

- ❌ Exact prompt string matching - Visual inspection handles this
- ❌ TypeScript type safety - Compiler handles this
- ❌ String concatenation operations - Language fundamentals
- ❌ Import resolution - Build system handles this
- ❌ Framework internals (Next.js, React)
- ❌ Third-party library behavior

### Test Approach

Tests use **simple checks** that verify behavior, not implementation:

```typescript
// Good: Tests what the builder does
expect(result).toContain('Discovery Mode');
expect(result).toContain('Workspace Context');
expect(result.length).toBeGreaterThan(100);

// Avoided: Tests how the builder does it
expect(result).toBe('exact string match'); // Too brittle
expect(builder.header).toBeDefined(); // Implementation detail
```

## Mock Data Strategy

Tests use simple mock objects that match the database schema:

```typescript
const mockDomain: Domain = {
  id: 'sales',
  label: 'Sales',
  // ... all required fields
};

const mockWorkspace: Workspace = {
  id: '1',
  context: 'Test workspace context',
  // ... all required fields
};
```

No complex mocking frameworks or mock injection - just plain objects.

## Edge Cases Covered

1. **Null Handling**
   - Null workspace
   - Null objective
   - Both null
   - Workspace with null context field
   - Objective with null context field

2. **Content Isolation**
   - Discovery builder doesn't include build mode content
   - Build builder doesn't include discovery mode content
   - Sales strategy builder doesn't include BRD content
   - BRD builder doesn't include sales strategy content

3. **Factory Error Cases**
   - Invalid agent mode
   - Invalid document type

## Running the Tests

```bash
# Run all builder tests
pnpm test __tests__/unit/prompts/builders

# Run specific test file
pnpm test __tests__/unit/prompts/builders/factories/agent-builder-factory.test.ts

# Run in watch mode
pnpm test:watch __tests__/unit/prompts/builders
```

## Test Results

```
Test Files  6 passed (6)
     Tests  56 passed (56)
  Duration  380ms
```

All tests passing as of Phase 1 completion.

## Future Test Additions

When new builder types are added (e.g., summary document builders), follow this pattern:

1. **Factory Test**: Add test case for new type
2. **Builder Test**: Create new test file following existing patterns
3. **Coverage**: Test composition, context handling, and isolation
4. **Mock Data**: Use simple objects matching schema

Example for future sales-call-summary builder:

```typescript
describe('SalesCallSummaryDocumentBuilder', () => {
  // Follow same pattern as sales-strategy-builder.test.ts
  it('should include sales call summary prompt content', () => {
    expect(result).toContain('sales call summary');
  });

  it('should not include strategy-specific content', () => {
    expect(result).not.toContain('Deal Probability');
  });
});
```

## Test Maintenance

- **When to Update**: Only when builder behavior changes (new sections, different composition logic)
- **What to Preserve**: Test structure and naming conventions for consistency
- **What to Avoid**: Don't make tests brittle by checking exact string matches
- **Code Review**: New tests should follow the patterns established here

## Quality Checklist

Before finalizing new tests:

- [ ] Tests are independent (can run in any order)
- [ ] Tests are deterministic (same input = same output)
- [ ] Tests are fast (no I/O, no delays)
- [ ] Tests are readable (clear intent, good names)
- [ ] Tests provide value (catch real bugs)
- [ ] Mocks are simple and minimal
- [ ] Edge cases are covered
- [ ] Tests align with this philosophy document
