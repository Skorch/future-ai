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
[Detailed file tree with annotations]

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

## 7. Unit Testing Plan
[Testing strategy and assertions]

## 8. Framework Notes
[Next.js 15+ specific considerations]
```

