# /spec Command - Architecture Specification Generator

Generate comprehensive, visual architecture specifications with pragmatic review.

## Usage
```
/spec [optional: brief topic description]
```

## Workflow

This command follows a disciplined architecture design process:

### Phase 1: Goal Analysis & Clarification
1. **Analyze Intent**: Parse the user's architecture goal to determine minimum required detail
2. **Project Context**: Leverage CLAUDE.md and existing codebase knowledge
3. **Clarifying Questions**: Ask targeted questions about:
   - Specific requirements and constraints
   - Scope hints (which directories/modules to focus on)
   - Integration points with existing systems
   - Performance/scale considerations
   - Security requirements

IMPORTANT:  always STOP and ASk USER.  Do NOT proceed with next phase until you are satisfied that ALL points are covered.  If they are not then you will ask MORE QUESTIONS.  You may proceed if the User EXPLICITLY states so.



### Phase 2: Comprehensive Research
1. **Parallel Delegation**: Launch multiple `code-searcher` subagents in parallel to:
   - Map existing patterns and conventions
   - Identify integration points
   - Find similar implementations
   - Discover constraints and dependencies

 To run multiple subagent tasks in parallel, you use a single message with multiple Task tool invocations. The response will come back as function_results with all the parallel results.

2. **Validation Gates**: Only proceed when research is comprehensive
   - Must understand existing architecture
   - Must identify all touchpoints
   - Must map current patterns

IMPORTANT:  always LOAD recommended files into context

### Phase 3: Architecture Design
Create visual, comprehensive markdown specification including:

1. **Visual Elements**:
   - File trees showing new/modified/referenced files
   - Mermaid sequence diagrams for flows
   - ASCII layouts for system topology
   - Component relationship diagrams

2. **Core Business Rules**:
   - Use code snippets ONLY for critical business logic
   - Focus on rules that MUST be followed
   - Avoid implementation details

3. **Structure**:
   ```markdown
   # Architecture: [Topic]
   Date: YYYY-MM-DD
   
   ## Executive Summary
   [2-3 sentence overview]
   
   ## Goals & Constraints
   - Primary objectives
   - Technical constraints
   - Business requirements
   
   ## Current State Analysis
   [Research findings from code-searcher]
   
   ## Proposed Architecture
   
   ### System Overview
   [ASCII or Mermaid diagram]
   
   ### File Structure
   ```
   src/
   ├── 📄 existing-file.ts (modified)
   ├── 🆕 new-feature/
   │   ├── index.ts
   │   └── types.ts
   └── 📁 lib/ (referenced)
   ```
   
   ### Data Flow
   [Mermaid sequence diagram]
   
   ### Core Business Rules
   ```typescript
   // ONLY critical rules here
   ```
   
   ### Integration Points
   [How it connects with existing systems]
   
   ### Migration Strategy
   [If applicable]
   ```

### Phase 4: Pragmatic Review
1. **Delegate to `code-quality-pragmatist`**: Review for over-engineering
2. **Receive Feedback**: Get specific suggestions for simplification

### Phase 5: Integration Analysis
1. **Evaluate Each Suggestion**:
   - Which pragmatic ideas are valid
   - Which architected complexity is necessary
   - WHY each decision (always explain rationale)
2. **Present to User**:
   ```
   ## Pragmatist Review Integration
   
   ### Accepted Simplifications:
   - [Change]: [Why it improves the design]
   
   ### Retained Complexity:
   - [Feature]: [Why it's necessary]
   
   Would you like to proceed with these changes?
   ```

### Phase 6: Self-Review & Gap Analysis
Perform a comprehensive self-review to catch implementation gaps and UI/UX considerations:

1. **Requirements Validation Checklist**:
   - [ ] Re-read original requirements line by line
   - [ ] Map each requirement to a specific implementation detail
   - [ ] Identify any requirements not addressed in the spec
   - [ ] Check for implicit requirements (e.g., "shown in screenshot" = UI needed)

2. **UI/UX Review** (if applicable):
   - [ ] All user-facing changes have UI mockups (ASCII or diagrams)
   - [ ] User interaction flows are documented
   - [ ] Edge cases addressed (empty states, errors, loading)
   - [ ] Accessibility considerations noted
   - [ ] Mobile/responsive behavior specified (if relevant)

3. **Technical Gap Analysis**:
   - [ ] Data format conversions needed (e.g., base64→binary, JSON→CSV)
   - [ ] Error handling for each operation
   - [ ] Performance implications considered
   - [ ] Security/authentication properly integrated
   - [ ] Database/storage implications clear

4. **Integration Completeness**:
   - [ ] All affected components identified
   - [ ] Props/data flow between components specified
   - [ ] API contracts fully defined
   - [ ] State management approach clear
   - [ ] Event handling documented

5. **Implementation Reality Check**:
   - [ ] File paths match project structure
   - [ ] Import patterns follow codebase conventions
   - [ ] Authentication patterns match existing code
   - [ ] Component patterns consistent with project
   - [ ] No assumptions about unavailable libraries

6. **Documentation of Findings**:
   ```
   ## Self-Review Findings
   
   ### Critical Gaps Identified:
   - [Gap]: [Impact and fix]
   
   ### UI/UX Clarifications Added:
   - [Component]: [What was added/clarified]
   
   ### Technical Corrections:
   - [Issue]: [Resolution]
   ```

**Decision Point**: If critical gaps found, update the spec and repeat Phase 6. Only proceed when all requirements are addressed.

### Phase 7: User Review & Final Edits
1. **Get User Feedback**: Present integration analysis
2. **Make Final Edits**: Incorporate approved changes only
3. **Output Final Spec**: Clean, integrated specification

## Output Location
```
/specs/YYYYMMDD_[topic-slug]/architecture.md
```

## Implementation Prompts

### For Goal Analysis:
"Analyze the architecture goal for [topic]. Determine the minimum required detail level. What are the critical decisions that must be made? What existing systems will be affected?"

### For Code Searcher Delegation:
"Search for [specific pattern/component] in [scope hints]. Need comprehensive analysis of:
1. Existing implementations of similar features
2. Current patterns and conventions
3. Integration touchpoints
4. Dependencies and constraints
Return exact file locations and line numbers."

### For Pragmatist Review:
"Review this architecture specification for over-engineering and unnecessary complexity. Focus on:
1. YAGNI violations
2. Premature abstractions
3. Simpler alternatives that achieve the same goals
4. Unnecessary flexibility for undefined future needs"

### For Self-Review (Phase 6):
"Perform self-review against original requirements:
1. Check each requirement is addressed
2. Verify UI locations match user's description/screenshots
3. Identify missing format conversions (base64, CSV, etc.)
4. Validate authentication patterns match codebase
5. Ensure all user-mentioned locations have implementations
Document any gaps found and fix them before proceeding."

## Example Topics
- `/spec auth-system` - Authentication architecture
- `/spec api-gateway` - API gateway design
- `/spec data-pipeline` - Data processing pipeline
- `/spec feature-flags` - Feature flag system

## Best Practices
1. **Research First**: Never architect without understanding current state
2. **Visual Over Verbal**: Use diagrams to communicate structure
3. **Pragmatic Balance**: Start comprehensive, simplify through review
4. **Always Why**: Every decision must have clear rationale
5. **Self-Review Rigorously**: Re-read requirements multiple times to catch gaps
6. **UI/UX Clarity**: Every user-facing change needs a mockup
7. **User Agency**: Final spec only includes user-approved changes