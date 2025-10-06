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
`karen`
`code-quality-pragmatist`
`ultra-think-debugger`
`architect`
`test-runner`

You should think about when you can delegate where you don't need the context of the task process - just the output.  Otherwise you should prioritze owning the task because you need the context.

IMPORTANT:  ANY time you need to perform a blanket file search, always use the `code-searcher` subagent, and think about whether you need to run parallel searches if you have more than one blanket topic to search for.
You always need to be thinking about your context size and usign the `code-searcher` subagent highly reduces your context window churn.
Examples:
- "I need to find all references of XYZ"
- "I need to find possible existing components or classes that handles this functionality"

Use your own `search` tool when:  
- I need to load a specific file but I don't know the full path
- I need a specific line of code, but I don't know which file

You will notice the difference between the two:  open ended vs specific

## Workflow


Always turn this workflow into a task list using the `TodoWrite` tool. You never skip steps - include all subagent calls in your initial TODO.  You may alter your TODO aferword as your requirements shift.

- [ ] 1. Task Analysis and Setup
   - [ ] Summarize your goals and purpose
   - [ ] State what 'complete' means for the whole workflow so that you know when to keep working on the task and don't give up when you cannot finish unit test failures
   - [ ] Spend time to THINK about the request and the strategy to find the right context to load
   - [ ] Assess complexity and potential challenges

- [ ] 2. Load Context and State Plan
   - [ ] Use `code-searcher` subagent to find the possible files to load into context
   - [ ] THINK DEEPLY about the requirements and the scope of changes needed

- [ ] 3. SubAgent Plan Review
   - [ ] use the `jenny` subagent to create a validation report of your plan
   - [ ] Summarize report `jenny` and analyze any suggested changes 

- [ ] 4. User Review
   - [ ] You ALWAYS ask the User to review and approve your proposed solution
   - [ ] If User asks for changes to your plan, you will:
      - [ ] revise your understanding
      - [ ] rethink your approach
      - [ ] ALWAYS re-request a review of your revised solution

- [ ] 5. Implementation
   - [ ] Implement code
   - [ ] Write and Run tests frequently and incrementally to verify progress

- [ ] 6. Validation
   - [ ] Run tests to verify functionality
   - [ ] Review test results thoroughly
   - [ ] Fix implementation if tests are failing
   - [ ] Have `code-reviewer` review the quality of the changes
      - [ ] Create a suggested list of updates and `Ask the User` to approve the suggested changes
   - [ ] Have `test-runner` run the unit tests and create a report of failed tests and the suggested fix
      - [ ] Create a suggested list of updates and `Ask the User` to approve the suggested changes

- [ ] 7. Final  
   - [ ] Summarize all changes made
   - [ ] Ask the User to visually verify the fix / perform any manual integration tests
   - [ ] Request final approval for this total batch of work

- [ ] 8. Completion 
   - [ ] using the `commit-orchestrator` subagent, instruct it to commit changes
   - [ ] update and close the `Issue` if applicable
   - [ ] Report results and any outstanding issues including any follow-up tasks needed



## Proposal Best Practices
- always show file tree indicating which files are referenced, edited, added, removed
- always show relevent code snippes where proposed changes will be made - highlighting the diff

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