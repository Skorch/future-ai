---
description: "Execute the code workflow for tasks when you need to follow a pre-determined technical spec or Issue."
---


## Core Guide

You always want to write
- KISS code
- SOLID code
- Readable code
- Maintainable code

You always investigagte what code NOT to write - as this can be as important as the code you DO write.  
- re-use components
- reduce complexity
- minimize unit testing to the essentials to validate business logic

You know how to write clean UI and you always consider what the UX should be even when you aren't directly prompted.

## SubAgents
You have access to:
`code-searcher`
`jenny`
unit-test-architect
commit-orchestrator
build-fixer
code-reviewer
nextjs-coder

ALWAYS delegate when instructed - your context window is precious and is the sole limiting factor to you accomplishing your work.  Delegating specialized tasks to subagents minimizes the impact on your context window limitations.

You should think about when you can delegate where you don't need the context of the task process - just the output.  Otherwise you should prioritze owning the task because you need the context.

IMPORTANT:  ANY time you need to perform a blanket file search, always use the `code-searcher` subagent, and think about whether you need to run parallel searches if you have more than one blanket topic to search for.
You always need to be thinking about your context size and using the `code-searcher` subagent highly reduces your context window churn.
Examples:
- "I need to find all references of XYZ"
- "I need to find possible existing components or classes that handles this functionality"

Use your own `search` tool when:  
- I need to load a specific file but I don't know the full path
- I need a specific line of code, but I don't know which file

You will notice the difference between the two:  open ended vs specific

## Workflow


Always turn this workflow into a task list using the `TodoWrite` tool. You never skip steps - include all subagent calls in your initial TODO.  You may alter your TODO afterword as your requirements shift.

- [ ] 1. Task Analysis and Setup
   - [ ] Summarize your goals and purpose
   - [ ] State what 'complete' means for the whole workflow so that you know when to keep working on the task and don't give up when you cannot finish unit test failures
   - [ ] Spend time to THINK about the request and the strategy to find the right context to load
   - [ ] Assess complexity and potential challenges

- [ ] 2. Load Context and State Plan
   - [ ] Use `code-searcher` subagent to find the possible files to load into context
   - [ ] THINK DEEPLY about the requirements and the scope of changes needed
   - [ ] You always use the Code Plan format described below

- [ ] 3. Step-By-Step DAG + Delegation Wave Plan
   - [ ] Generate a list of steps to complete the plan
   - [ ] Think hard about how to bundle each step into a DAG
   - [ ] Create a list of Waves and each step within the wave

- [ ] 4. User Review
   - [ ] You ALWAYS ask the User to review and approve your proposed solution
   - [ ] If User asks for changes to your plan, you will:
      - [ ] revise your understanding
      - [ ] rethink your approach
      - [ ] ALWAYS re-request a review of your revised solution

- [ ] 5. Delegate Waves
   - [ ] For each Wave, delegate each step to concurrent `nextjs-coder` subagent tasks
      - [ ] For each subagent task prompt, use a consistent prompt format to explain exactly what is in scope and out of scope
   
- [ ] 6. Validation
   - [ ] Run tests to verify functionality
   - [ ] Review test results thoroughly
   - [ ] Fix implementation if tests are failing
   - [ ] Have `code-reviewer` review the quality of the changes
      - [ ] Create a suggested list of updates and `Ask the User` to approve the suggested changes
   - [ ] Have `unit-test-architect` run the unit tests and create a report of failed tests and the suggested fix
      - [ ] Create a suggested list of updates and `Ask the User` to approve the suggested changes

- [ ] 7. Final  
   - [ ] Summarize all changes made
   - [ ] Ask the User to visually verify the fix / perform any manual integration tests
   - [ ] Request final approval for this total batch of work
   - [ ] Build: always use the `build-fixer` subagent to build and fix minor build issues
   - [ ] Test: always use the `unit-test-architect` subagent to write tests, run tests, fix test issues 
   - in both cases, be sure to give it context of the changes (ie give it the path to the speec file) so it can make decisions on the fly

- [ ] 8. Completion 
   - [ ] using the `commit-orchestrator` subagent, instruct it to commit changes
   - [ ] update and close the `Issue` if applicable
   - [ ] Report results and any outstanding issues including any follow-up tasks needed

- [ ] 9. Summary
   - [ ] You will always write a completion report so that the next phase has context of what you implemented
   

## Proposal Best Practices
Always follow this format for quick Human code reviews.  Your aim is to demonstrate WHY, WHERE, HOW in a brief but comprehensive fashion.  Less is more so long as you have highlighted all of the complexities

````
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

When you create a Plan, you are NOT writing the full code.  Even when showing a 'new file' you NEVER show the entire code written - instead you condense into:  
- What file: file path you intend to make change in
- What function signature
- Snippets of key business rules /complexity

Everything else is assumed to be written using best practices and does not require human review.

Example of a contextual diff format:

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
````


## DAG & Wave Design

Your goal is to design a way to maximize the number of **concurrent parallel** tasks[] you can run at once w/o any file or dependency overlaps.  This is why thinking in terms of a DAG is ideal as a DAG must be directional and it must not have any looping depdendencies.

Example Wave Design:
```
  🎯 Parallel Execution Strategy

  ┌─────────────────────────────────────────────────────────┐
  │ WAVE 1: Foundation (Parallel)                           │
  │  - Group 1a, 1b, 1c (types & utils)                    │
  │  - Group 3d (prompt actions - no dependencies)         │
  └─────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────┐
  │ WAVE 2: Auth & Simple Components (Parallel)            │
  │  - Group 2a, 2b (middleware & DAL)                     │
  │  - Group 3a, 3b, 3c (UI components)                    │
  │  - Group 4a (layer editor)                             │
  │  - Group 6a (sidebar update)                           │
  └─────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────┐
  │ WAVE 3: Complex Components (Sequential)                │
  │  - Group 4b (stack view - depends on 4a)               │
  └─────────────────────────────────────────────────────────┘
                            ↓
  ┌─────────────────────────────────────────────────────────┐
  │ WAVE 4: Server Implementation (Parallel)               │
  │  - Group 5a (server actions)                           │
  │  - Group 5b (page component - depends on 4b)           │
  │  - Group 6b (admin layout)                             │
  └─────────────────────────────────────────────────────────┘

  ---
  📊 Dependency Matrix

  | Step           | Depends On | Can Run With                |
  |----------------|------------|-----------------------------|
  | 1a, 1b, 1c, 3d | None       | Each other (WAVE 1)         |
  | 2a             | 1a         | 2b, 3a-c, 4a, 6a (WAVE 2)   |
  | 2b             | None       | 2a, 3a-c, 4a, 6a (WAVE 2)   |
  | 3a             | 1c         | 2a-b, 3b-c, 4a, 6a (WAVE 2) |
  | 3b             | 1c         | 2a-b, 3a,c, 4a, 6a (WAVE 2) |
  | 3c             | 1b         | 2a-b, 3a-b, 4a, 6a (WAVE 2) |
  | 4a             | None       | 2a-b, 3a-c, 6a (WAVE 2)     |
  | 6a             | 1a         | 2a-b, 3a-c, 4a (WAVE 2)     |
  | 4b             | 4a         | None (WAVE 3)               |
  | 5a             | 2b         | 5b, 6b (WAVE 4)             |
  | 5b             | 4b         | 5a, 6b (WAVE 4)             |
  | 6b             | None       | 5a-b (WAVE 4)               |

```


## Workflow Rules
These rules are critical to the success of your workflow. 
- Always spot gaps in your understanding and ask the user for clarification
   - You may do this at any time - not just when the workflow states
   - Examples:
      - The code I'm seeing contradicts my expectation
      - I made an early assumption which is leading me away from solving the issue
      - I've hit a blocker and my repeated attempts (2+) have failed to break through (small progress isn't good enough)
- Where the workflow DOES state to ask the user, this is a required checkpoint in your workflow and you must follow
- You will NEVER choose to commit code before the task is fully complete (you must state what complete means)
- When asking User for review of your proposed solution, you will always continue asking when the User asks followup or requests changes

## Tool Rules
Always use the specified approaches stated in the workflow. This ensures you produce the most consistent and accurate results and ensures the user can validate your approach.
- Always create task lists using `TodoWrite` tool
- Always ask the user directly for reviews and clarification
