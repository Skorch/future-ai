# Prompt Extraction Inventory

This document catalogs all existing prompts in the codebase that need to be extracted into the database as seed data.

## System Architecture

### Current Prompt Composition Flow
1. **Chat Route** (`app/(chat)/api/workspace/[workspaceId]/chat/route.ts`):
   - Uses `createPrepareStep()` which calls builder system for each step
   - No initial system prompt passed to `streamText()` - prepareStep provides complete prompt
   - Builders generate complete system prompts including base, capabilities, domain, mode, and contexts

2. **PrepareStep** (`lib/ai/modes/prepare-step.ts`):
   - Called before EACH agent step (including Step 0)
   - Uses builder system: `createAgentBuilder(mode).generate(domain, workspace, objective)`
   - Returns complete system prompt with all components assembled

3. **Builder System**:
   - Agent builders (discovery, build) extend base context builder
   - Inject domain prompts, mode prompts, and specialized contexts
   - All prompts come from `lib/ai/prompts/builders/shared/prompts/` directory structure

---

## 1. SYSTEM PROMPTS (Base Level)

### Files:
- `lib/ai/prompts/system.ts`
- `lib/ai/prompts/builders/shared/prompts/system.prompts.ts` (duplicate)

### Exports:

#### `SYSTEM_PROMPT_BASE`
- **Type**: System prompt text
- **Used by**: All agents via `composeSystemPrompt()`
- **Content**: Core philosophy, investigation-first mindset, delivery excellence
- **Database mapping**: `category: 'system'`, `key: 'base'`, `domainId: null`

#### `PLAYBOOK_GUIDANCE`
- **Type**: System prompt text
- **Used by**: All agents via `composeSystemPrompt()`
- **Content**: Playbook workflow instructions, when to use, how to execute
- **Database mapping**: `category: 'system'`, `key: 'playbook_guidance'`, `domainId: null`

#### `getSystemPromptHeader()`
- **Type**: Function (dynamic)
- **Returns**: Current date context
- **Database mapping**: Not stored (dynamic function)

---

## 2. MODE PROMPTS

### Files:
- `lib/ai/prompts/builders/shared/prompts/modes/discovery.prompts.ts`
- `lib/ai/prompts/builders/shared/prompts/modes/build.prompts.ts`

### Discovery Mode

#### `DISCOVERY_MODE_PROMPT`
- **Type**: Function taking `ModeContext` (unused parameter)
- **Used by**: `discovery-agent-builder.ts`
- **Content**: Discovery mission, playbook usage, tool selection, workflow
- **Database mapping**: `category: 'mode'`, `key: 'discovery'`, `domainId: null`
- **Sections**:
  - Discovery Mission
  - Structured Workflows with Playbooks
  - Tool Selection
  - Discovery Workflow (4 phases)
  - Questions to Answer Through Investigation

### Build Mode

#### `BUILD_MODE_PROMPT`
- **Type**: Function taking `ModeContext` (unused parameter)
- **Used by**: `build-agent-builder.ts`
- **Content**: Build mode focus, document type selection, build approach
- **Database mapping**: `category: 'mode'`, `key: 'build'`, `domainId: null`
- **Sections**:
  - Build Mode Focus
  - Document Type Selection
  - Build Approach
  - Need More Context?

---

## 3. DOMAIN PROMPTS

### Sales Intelligence Domain
**File**: `lib/ai/prompts/builders/shared/prompts/domains/sales-intelligence.prompts.ts`

#### `SALES_INTELLIGENCE_PROMPT`
- **Content**: Sales call workflow, BANT qualification, deal management
- **Database mapping**: `category: 'domain'`, `key: 'main'`, `domainId: 'sales-intelligence'`

#### `SALES_WORKSPACE_CONTEXT_GUIDANCE`
- **Content**: What to capture/not capture in workspace context for sales
- **Database mapping**: `category: 'context_guidance'`, `key: 'workspace'`, `domainId: 'sales-intelligence'`

#### `SALES_WORKSPACE_CONTEXT_PLACEHOLDER`
- **Content**: Placeholder text for empty workspace context
- **Database mapping**: `category: 'context_placeholder'`, `key: 'workspace'`, `domainId: 'sales-intelligence'`

#### `SALES_OBJECTIVE_CONTEXT_GUIDANCE`
- **Content**: What to capture in objective context for sales (deal-specific)
- **Database mapping**: `category: 'context_guidance'`, `key: 'objective'`, `domainId: 'sales-intelligence'`

#### `SALES_OBJECTIVE_CONTEXT_PLACEHOLDER`
- **Content**: Placeholder text for empty objective context
- **Database mapping**: `category: 'context_placeholder'`, `key: 'objective'`, `domainId: 'sales-intelligence'`

### Meeting Intelligence Domain
**File**: `lib/ai/prompts/builders/shared/prompts/domains/meeting-intelligence.prompts.ts`

#### `MEETING_INTELLIGENCE_PROMPT`
- **Content**: Meeting/transcript processing, document type determination, workflow
- **Database mapping**: `category: 'domain'`, `key: 'main'`, `domainId: 'meeting-intelligence'`

#### `MEETING_WORKSPACE_CONTEXT_GUIDANCE`
- **Content**: What to capture/not capture in workspace context for meetings
- **Database mapping**: `category: 'context_guidance'`, `key: 'workspace'`, `domainId: 'meeting-intelligence'`

#### `MEETING_WORKSPACE_CONTEXT_PLACEHOLDER`
- **Content**: Placeholder text for empty workspace context
- **Database mapping**: `category: 'context_placeholder'`, `key: 'workspace'`, `domainId: 'meeting-intelligence'`

#### `MEETING_OBJECTIVE_CONTEXT_GUIDANCE`
- **Content**: What to capture in objective context for projects
- **Database mapping**: `category: 'context_guidance'`, `key: 'objective'`, `domainId: 'meeting-intelligence'`

#### `MEETING_OBJECTIVE_CONTEXT_PLACEHOLDER`
- **Content**: Placeholder text for empty objective context
- **Database mapping**: `category: 'context_placeholder'`, `key: 'objective'`, `domainId: 'meeting-intelligence'`

---

## 4. DOCUMENT TYPE PROMPTS

### Business Requirements Document (BRD)
**Files**:
- `lib/artifacts/document-types/business-requirements/prompts.ts`
- `lib/ai/prompts/builders/shared/prompts/documents/business-requirements.prompts.ts`

#### `BRD_PROMPT`
- **Type**: Instruction prompt
- **Content**: Creation principles, stakeholder roles, field definitions, generation instructions
- **Database mapping**: `category: 'document'`, `key: 'instruction'`, `documentType: 'business-requirements'`

#### `BRD_TEMPLATE`
- **Type**: Template markdown
- **Content**: Full BRD structure with sections and placeholders
- **Database mapping**: `category: 'document'`, `key: 'template'`, `documentType: 'business-requirements'`

#### `BRD_PUNCHLIST_PROMPT`
- **Type**: Punchlist guidance
- **Content**: What to discover, track categories, forward-thinking direction
- **Database mapping**: `category: 'document'`, `key: 'punchlist'`, `documentType: 'business-requirements'`

### Sales Strategy
**Files**:
- `lib/artifacts/document-types/sales-strategy/prompts.ts`
- `lib/ai/prompts/builders/shared/prompts/documents/sales-strategy.prompts.ts`

#### `SALES_STRATEGY_PROMPT`
- **Type**: Instruction prompt
- **Content**: Strategic analysis task, framework, probability assessment, risk analysis
- **Database mapping**: `category: 'document'`, `key: 'instruction'`, `documentType: 'sales-strategy'`

#### `SALES_STRATEGY_TEMPLATE`
- **Type**: Template markdown
- **Content**: Full strategy structure with executive assessment, risks, recommendations
- **Database mapping**: `category: 'document'`, `key: 'template'`, `documentType: 'sales-strategy'`

#### `SALES_STRATEGY_PUNCHLIST_PROMPT`
- **Type**: Punchlist guidance
- **Content**: BANT-C qualification needs, risk tracking, forward-thinking
- **Database mapping**: `category: 'document'`, `key: 'punchlist'`, `documentType: 'sales-strategy'`

### Sales Call Summary
**File**: `lib/ai/prompts/builders/shared/prompts/documents/sales-call-summary.prompts.ts`

#### `SALES_CALL_SUMMARY_PROMPT`
- **Type**: Instruction prompt (simple structured output)
- **Content**: Summary structure with sections for customer info, needs, solution, objections, etc.
- **Database mapping**: `category: 'document'`, `key: 'instruction'`, `documentType: 'sales-call-summary'`

### Requirements Meeting Summary
**File**: `lib/ai/prompts/builders/shared/prompts/documents/requirements-meeting-summary.prompts.ts`

#### `REQUIREMENTS_MEETING_SUMMARY_PROMPT`
- **Type**: Instruction prompt (simple structured output)
- **Content**: Summary structure with sections for context, requirements, dependencies, etc.
- **Database mapping**: `category: 'document'`, `key: 'instruction'`, `documentType: 'requirements-meeting-summary'`

---

## 5. TOOL PROMPTS

### Ask User Tool
**File**: `lib/ai/prompts/builders/shared/prompts/tools/ask-user.prompts.ts`

#### `ASK_USER_PROMPT`
- **Type**: Tool usage guidance
- **Content**: BLUF structure, when to use, anti-patterns, good/bad examples
- **Database mapping**: `category: 'tool'`, `key: 'askUser'`, `domainId: null`

### Query RAG Tool
**File**: `lib/ai/prompts/builders/shared/prompts/tools/query-rag.prompts.ts`

#### `QUERY_RAG_PROMPT`
- **Type**: Tool usage guidance
- **Content**: Use cases, when to use/not use, workflow, search patterns
- **Database mapping**: `category: 'tool'`, `key: 'queryRAG'`, `domainId: null`

### Get Playbook Tool
**File**: `lib/ai/prompts/builders/shared/prompts/tools/get-playbook.prompts.ts`

#### `GET_PLAYBOOK_PROMPT`
- **Type**: Tool usage guidance
- **Content**: What playbooks are, when to use, how to execute
- **Database mapping**: `category: 'tool'`, `key: 'getPlaybook'`, `domainId: null`

---

## 6. GENERATION/UTILITY PROMPTS

### Workspace Context Generation
**File**: `lib/ai/prompts/builders/shared/prompts/generation/context.prompts.ts`

#### `WORKSPACE_CONTEXT_GENERATION_PROMPT`
- **Type**: Context management guidance
- **Content**: Evidence-based principles, scope, refinement, organization
- **Database mapping**: `category: 'generation'`, `key: 'workspace_context'`, `domainId: null`

#### `OBJECTIVE_CONTEXT_GENERATION_PROMPT`
- **Type**: Context management guidance
- **Content**: Objective-specific context principles, what to capture
- **Database mapping**: `category: 'generation'`, `key: 'objective_context'`, `domainId: null`

### Title Generation
**File**: `lib/ai/prompts/builders/shared/prompts/generation/title.prompts.ts`

#### `AI_TEXT_GENERATION_SYSTEM_PROMPT`
- **Type**: Generation guidance
- **Content**: Anti-hallucination rules, output scaling, examples
- **Database mapping**: `category: 'generation'`, `key: 'ai_text'`, `domainId: null`

#### `CHAT_TITLE_GENERATION_SYSTEM_PROMPT`
- **Type**: Generation guidance
- **Content**: Chat title generation instructions
- **Database mapping**: `category: 'generation'`, `key: 'chat_title'`, `domainId: null`

#### `KNOWLEDGE_DOCUMENT_METADATA_SYSTEM_PROMPT`
- **Type**: Function taking maxTitleLength
- **Content**: Document classification and title formatting rules
- **Database mapping**: `category: 'generation'`, `key: 'knowledge_metadata'`, `domainId: null`
- **Note**: Function returns string with interpolated maxTitleLength

#### `OBJECTIVE_DOCUMENT_TITLE_SYSTEM_PROMPT`
- **Type**: Generation guidance
- **Content**: Objective document title generation
- **Database mapping**: `category: 'generation'`, `key: 'objective_title'`, `domainId: null`

---

## 7. DEPRECATED/UNUSED PROMPTS

### Document Summary Prompts
**File**: `lib/prompts/document-summary-prompts.ts`

These appear to be older prompts that may have been replaced by the builder system. Investigation needed to confirm if still used.

---

## PROMPT ASSEMBLY PATTERNS

### Current System Prompt Composition (via Builder)

The builder system assembles prompts in this order:

1. **Base Context Builder** (`BaseContextBuilder`):
   ```
   [System Prompt Header (dynamic date)]
   [SYSTEM_PROMPT_BASE]
   [generateSystemCapabilities() - dynamic based on domain]
   [PLAYBOOK_GUIDANCE]
   [Domain prompts from domain.prompt]
   ```

2. **Agent Builder** (Discovery/Build):
   ```
   [Base context from above]
   [Mode-specific prompt (DISCOVERY_MODE_PROMPT or BUILD_MODE_PROMPT)]
   ```

3. **Specialized Context Builders** (Workspace/Objective):
   ```
   [Workspace context if available]
   [Objective context if available]
   ```

### Tool Descriptions
Tool prompts are used in tool definitions, not system prompts:
- Tool descriptions are short (~50 chars) in tool definition
- Full guidance prompts are stored separately and may be injected contextually

---

## DATABASE SCHEMA REQUIREMENTS

Based on this inventory, the `prompt` table needs:

```typescript
{
  id: uuid
  category: enum('system', 'mode', 'domain', 'document', 'tool', 'generation', 'context_guidance', 'context_placeholder')
  key: string  // 'base', 'discovery', 'main', 'instruction', 'template', 'punchlist', etc.
  domainId: string | null  // null for universal prompts
  documentType: string | null  // null unless category='document'
  content: text  // The actual prompt text
  metadata: jsonb  // For template variables, version info, etc.
  version: integer  // For prompt versioning
  isActive: boolean  // For A/B testing or rollback
  createdAt: timestamp
  updatedAt: timestamp
}
```

---

## EXTRACTION PRIORITIES

### Phase 1: Core System (Universal)
1. SYSTEM_PROMPT_BASE
2. PLAYBOOK_GUIDANCE
3. Mode prompts (discovery, build)
4. Tool prompts (askUser, queryRAG, getPlaybook)
5. Generation prompts (context, title)

### Phase 2: Domain-Specific
1. Sales Intelligence domain prompts (5 prompts)
2. Meeting Intelligence domain prompts (5 prompts)

### Phase 3: Document Types
1. Business Requirements (3 prompts: instruction, template, punchlist)
2. Sales Strategy (3 prompts: instruction, template, punchlist)
3. Sales Call Summary (1 prompt: instruction)
4. Requirements Meeting Summary (1 prompt: instruction)

### Phase 4: Dynamic Functions
1. Convert `getSystemPromptHeader()` to template with date variables
2. Convert `KNOWLEDGE_DOCUMENT_METADATA_SYSTEM_PROMPT(maxTitleLength)` to template

---

## MIGRATION STRATEGY

### Code Changes Needed:

1. **Builder System** (`lib/ai/prompts/builders/`):
   - Replace static imports with DB queries
   - Cache prompts in memory per request
   - Add prompt loading utility functions

2. **Tool Definitions** (`lib/ai/tools/`):
   - Load tool prompts from DB instead of imports
   - Keep tool descriptions short in code
   - Reference full guidance in DB

3. **Document Type Handlers** (`lib/artifacts/document-types/`):
   - Load prompts via builder system
   - Remove static prompt imports
   - Reference prompts by documentType + key

4. **Mode Configurations** (`lib/ai/modes/`):
   - Load mode prompts from DB
   - Cache in mode config objects

### Backward Compatibility:
- Keep existing prompt files during migration
- Use feature flag to toggle DB prompts vs file prompts
- Validate DB prompt content matches file content

---

## PROMPT DEPENDENCIES

### Prompt Usage Chains:

1. **Agent System Prompt** =
   - SYSTEM_PROMPT_BASE (1)
   - + PLAYBOOK_GUIDANCE (1)
   - + Domain prompt (1 of 2)
   - + Mode prompt (1 of 2)
   - + Workspace context (optional)
   - + Objective context (optional)

2. **Document Generation** =
   - Document instruction prompt (1 per type)
   - + Document template (1 per type)
   - + Source documents/context
   - Tool: generateDocumentVersion

3. **Punchlist Management** =
   - Document punchlist prompt (1 per type)
   - + Current punchlist state
   - Tool: updatePunchlist

4. **Context Updates** =
   - WORKSPACE_CONTEXT_GENERATION_PROMPT (1)
   - OR OBJECTIVE_CONTEXT_GENERATION_PROMPT (1)
   - + Domain-specific guidance
   - + Current context
   - Tools: updateWorkspaceContext, updateObjectiveContext

---

## TOTAL PROMPT COUNT

- **System**: 2 (base, playbook)
- **Mode**: 2 (discovery, build)
- **Domain**: 10 (5 sales + 5 meeting)
- **Document**: 10 (BRD: 3, Sales Strategy: 3, Sales Call: 1, Req Meeting: 1, + 2 more from metadata files)
- **Tool**: 3 (askUser, queryRAG, getPlaybook)
- **Generation**: 5 (workspace_context, objective_context, ai_text, chat_title, knowledge_metadata)

**Total: ~32 prompts to extract**

---

## TESTING STRATEGY

1. **Unit Tests**: Compare DB prompts vs file prompts (exact match)
2. **Integration Tests**: Verify builder assembles prompts correctly
3. **E2E Tests**: Test agent behavior with DB prompts
4. **Rollback Plan**: Feature flag to revert to file-based prompts

---

## NOTES

- All prompt files follow pattern: `[name].prompts.ts`
- Prompts are TypeScript string exports (template literals)
- Some prompts are functions (for dynamic content like date)
- Builder system uses static imports currently - needs refactoring for DB
- PrepareStep is called before EVERY agent step, rebuilding complete prompt
- No caching of assembled prompts between steps (could optimize)
