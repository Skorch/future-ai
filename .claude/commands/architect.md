---
description: "Execute the architect workflow for creating detailed technical specifications and atomic implementation plans"
---

# Architect Workflow

Execute this workflow when you need to plan, design, or strategize before implementation. Perfect for breaking down complex problems, creating technical specifications, designing system architecture, or brainstorming solutions before coding.

**Context**: $ARGUMENTS



## Architecture Specification Process

### Task Setup
- [ ] Read and understand requirements
- [ ] Summarize your goals and purpose  
- [ ] Spend time to THINK about the request and strategy to find the right context to load
- [ ] Review attached screenshots (if provided), paying close attention to all displayed data fields, especially for related entities
- [ ] **Existing Code / Code Reuse / Good Architecture**
  - [ ] always use the `code-searcher` agent to create parallel subagent tasks to search existing codebase (`src/app`) for matching components
  - [ ] Consider whether the change required is a UI change, Data change, or both
  - [ ] Evaluate whether existing components satisfy the required function
    - [ ] If it does, add it to the list of components to be used
    - [ ] If it does not, decide whether it can be SAFELY extended or needs to be replaced
      - [ ] If it can be SAFELY extended, add it to the list of components to be extended
      - [ ] If it needs to be replaced, add it to the list of components to be replaced
- [ ] Ask clarifying questions and use your judgment to get answers
- [ ] Assess complexity and potential challenges
- [ ] Determine scope of changes needed
- [ ] Generate a CUSTOM CHECKLIST based on the task

### Architecture Review (CRITICAL)
**IMPORTANT: Never start implementation until you have explicitly asked user to proceed**

- [ ] Consider the current Issue and how it relates to UX and/or program flow
- [ ] Consider the ideal UX of program flow  
- [ ] Restate the problem
- [ ] Think and report on your proposed architecture
- [ ] ALWAYS ask the User to review and approve your proposed architecture
- [ ] If User asks for changes to your plan:
  - [ ] Revise your understanding
  - [ ] Rethink your approach
  - [ ] ALWAYS re-request a review of your revised architecture

### Write the Architecture Specification

**Include ALL of the following:**

- [ ] **Affected Files:** Detailed file tree showing created, modified, and referenced files
  - CRITICAL:  ALWAYS start with a full file tree and ALWAYS maintain / update file tree.  the list of file edits should be your source of truth
- [ ] **Type Definitions:** Define all necessary TypeScript types/interfaces, ensuring all data fields mentioned in the UI spec are included
- [ ] **Data Mapping Tables:** Include explicit tables mapping Database Column Name → TypeScript Property Name for key data types, using verified column names from migrations
- [ ] **Data Access Layer (DAL) Design:**
  - [ ] Detail the DAL class structure and methods
  - [ ] Specify that Supabase nested selects (e.g., `select('*, related_table(*)')`) are the preferred method for fetching related data
- [ ] **Page Component Designs:** For each page:
  - [ ] Describe Server and Client component responsibilities
  - [ ] Detail the data fetching strategy (SSR, Server Actions, Client-side triggers via URL updates)
  - [ ] **Component Data Usage Table:** Include a table detailing exactly which properties from fetched TypeScript types are used by the component and its immediate children
- [ ] **Server Actions:** Define necessary Server Actions, including validation logic (Zod recommended)
- [ ] **New/Missing Component Specifications:** Detail specs for any new components needed
- [ ] **Component Hierarchy Diagrams:** Generate a *separate* Mermaid `classDiagram` for *each distinct page* (e.g., List, Detail, Create/Edit), clearly labeling components as `<<Server>>` or `<<Client>>`. Add a note clarifying that diagrams show rendering structure, not direct import dependencies between Server/Client components
- [ ] **User Action Flow Diagrams:** Generate *concrete* Mermaid `sequence` diagrams for *each major user interaction flow* (e.g., Filtering List, Creating Opportunity, Viewing Related Data, Status Changes). Focus *only* on User → Client Component → Server Component/Action flow, omitting internal `activate`/`deactivate`, DAL, and database steps
- [ ] **Unit Testing Plan:** Include a table outlining test goals and key assertions for the DAL, Server Actions, and all *newly created Client Components*
- [ ] **Framework Notes:** Explicitly note that the project uses Next.js 15+ and that `params`/`searchParams` in async Server Components are `Promise` objects requiring `await`. Include an example signature

### Architecture Validation
- [ ] Request a review of the Architecture Specification file from the user
- [ ] **IF approved, turn the technical spec into a list of atomic units in individual markdown files:**
  - [ ] **Sequencing Note:** Ensure foundational UI elements (e.g., sidebar links) are included in the plan for the *first relevant page component*
  - [ ] For each unit of work:
    - [ ] Include detailed file tree (add, update, rm, reference)
    - [ ] Include key data points/interfaces
    - [ ] Include task-specific component hierarchy diagram
    - [ ] Include step-by-step technical implementation details
    - [ ] **DAL Plan Specific:** Provide code snippets for complex Supabase queries, especially those involving nested selects and filtering on joined data
    - [ ] Include a specific Coder Workflow Checklist based on best practices

## Workflow Execution Instructions

1. **Use `TodoWrite` tool** to track your progress through the workflow steps
2. **CRITICAL**: Always ask user to review and approve your proposed architecture before proceeding
3. **Exit Planning**: Use `ExitPlanMode` tool when ready to begin implementation
4. **File Organization**: Save plans in `specs/{initiative_name}/architecture_spec_{initiative_name}.md`


---

## Available Templates

When creating architecture specifications, use the following template structure:

### Architecture Specification Template

```markdown
# Architecture Specification: [Feature Name]

## 1. Affected Files
[Detailed ascii file tree with annotations]

## 2. Type Definitions
[TypeScript interfaces and types]

## 3. Data Access Layer (DAL) Design
[DAL class structure and methods]

## 4. Page Component Designs
[Server/Client component responsibilities]

## 5. Component Hierarchy Diagrams
[Mermaid diagrams for each page]

## 6. User Action Flow Diagrams
[Sequence diagrams for user interactions]

## 7. Unit Testing Table
[Table listing all core unit test assertions and edge cases]

## 7. Phase Plan
[List of big milestones and the scope of each in a checklist format]
[Be clear about scope including testing - each milestone is responsible for its own tests]
[Each phase should be documented using the Phase Document Template below]


## 8. Framework Notes
[Next.js 15+ specific considerations]
```

### Phase Document Template

When breaking implementation into phases, use this template for each phase document:

```markdown
# Phase [N]: [Phase Title]

## Overview
[Brief description of what this phase accomplishes]

**Dependency**: [Prerequisites - which phases must be complete, or "None - this is the foundation phase"]

**Scope**: [Quantified summary, e.g. "~25 files | 3 DAL implementations | 8 new API routes | 5 server actions"]

## Success Criteria
- ✅ [What will work after this phase]
- ✅ [Measurable outcomes]
- ❌ [What will still be broken - be explicit]
- ✅ [How to verify success]

## Out of Scope (NOT in this phase)

This phase focuses on [primary goal]. The following are explicitly OUT OF SCOPE:

- **[Feature/System]**: [Why deferred - e.g., "Save for dedicated epic"]
- **[Optimization]**: [Why not included - e.g., "Not critical for MVP"]
- **[Complex Change]**: [Why avoided - e.g., "Requires broader refactor"]

## Critical Review Points

### ⚠️ High Risk Areas

**[Risk Name]** → [Step N: Section Name, Function/Area]
- [What could go wrong]
- [Why this is risky]
- [Impact if not handled correctly]
- **✓ Verify**: [What decision needs validation from reviewer]

[Additional risk areas as needed...]

## File Tree

```
ADD:
├── [New files with annotations]

UPDATE:
├── [Modified files with change type]

REMOVE:
├── [Files to delete]

EXISTING FILES TO REVIEW:
├── [Files that exist but need checking]
```

## Implementation Steps

### Step 1: [Task Name]
[Use contextual diff format for code changes - see Code Change Format below]

### Step 2: [Task Name]
[Continue with clear, actionable steps using contextual diffs]

## Code Change Format

Your goal is not to write the code for the 'Coding Agent'.  Rather your goal is to provide key direction and focus.  You accomplish this by focusing on the following:
- What file
- What function signature
- Key business rule examples

When documenting code changes in implementation steps, use contextual diff format:

### Basic Change Example:
```typescript
// BEFORE (around line 120):
const { id, workspaceId, messages } = body;

// AFTER:
const { id, workspaceId, objectiveId, messages } = body;
if (!objectiveId) {
  return NextResponse.json({ error: 'objectiveId required' }, { status: 400 });
}

// WHY: Every chat must belong to an objective now - no standalone chats
// This enforces the objective-centric architecture
```

### Deletion Example:
```typescript
// DELETE entire onFinish callback (lines ~145-171):
onFinish: async ({ response }) => {
  // ... 20+ lines of messageId linking logic ...
}

// WHY: No longer linking documents to messages after creation
// Documents now link to objectives during creation
```

### Pattern Example (Multiple Files):
```typescript
// PATTERN for all handlers in lib/artifacts/document-types/*/server.ts:

// BEFORE:
async onGenerateDocument(context, params): Promise<{ versionId: string }> {
  // ...
  return { versionId: result.versionId };
}

// AFTER:
async onGenerateDocument(context, params): Promise<{ documentId: string; versionId: string }> {
  // ...
  return { documentId: result.documentId, versionId: result.versionId };
}

// Apply to: sales-call-summary, meeting-analysis, meeting-agenda,
// meeting-minutes, business-requirements, sales-strategy, text, use-case

// WHY: Return structure needs both IDs for complete reference
```

### Code Change Best Practices:
- Show BEFORE/AFTER context with enough surrounding code to locate the change
- Include approximate line numbers or semantic markers (e.g., "in POST handler")
- Add WHY comments explaining the reasoning for each change
- For deletions, show what to remove with clear markers
- For new files, show the complete file content
- For patterns across multiple files, show one example then list all affected files

## Coder Workflow Checklist

1. [ ] **[Major Task Group]**
   - [ ] Specific action item
   - [ ] Another action item

2. [ ] **[Another Task Group]**
   - [ ] Action items...

3. [ ] **Verify Success Criteria**
   - [ ] Test command: `pnpm test`
   - [ ] Build command: `pnpm build`
   - [ ] Expected failures noted

## Important Notes

- **[Critical Reminder]**: [Key information that must not be forgotten]
- **[Architecture Decision]**: [Why something was done a certain way]
- **[Warning]**: [Potential pitfalls]

## [Optional] Breaking Changes

[If applicable, list what will break and what depends on it]
```

### Phase Template Best Practices

1. **Overview Section**:
   - Always include Dependency and Scope lines
   - Scope should quantify the work (file count, components, etc.)

2. **Critical Review Points**:
   - Focus on architectural decisions needing validation
   - Include navigation hints (Step N, function names)
   - Each point should have a verification question
   - Avoid line numbers (they change) - use semantic references

3. **Success Criteria**:
   - Be explicit about what works AND what doesn't
   - Include both positive (✅) and negative (❌) criteria
   - Make criteria testable/verifiable

4. **File Tree**:
   - Group by operation (ADD, UPDATE, REMOVE)
   - Include annotations for clarity
   - Note existing files that need review

5. **Implementation Steps**:
   - Number steps clearly
   - Use contextual diff format for code changes (see Code Change Format section)
   - Include WHY comments explaining reasoning
   - Reference these steps in Critical Review Points
   - Avoid showing entire files unless they're new
   - Focus on what changes, not what stays the same

6. **Code Changes**:
   - NEVER use full file contents for existing files
   - Use BEFORE/AFTER contextual diffs
   - Include semantic markers or line number hints
   - Always explain WHY the change is needed
   - For patterns across multiple files, show one example then list others

7. **Phase Sequencing**:
   - Each phase should be independently reviewable
   - Dependencies must be explicit
   - Later phases can reference stubs from earlier phases
   - Phases can leave the system partially broken (document this clearly)

