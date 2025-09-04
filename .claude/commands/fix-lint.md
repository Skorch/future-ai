 ## Core Guide

  Fix typescript check errors Build errors in an iterative fashion.
  - lint `npm run lint`
  - type: `npm run type-check`
  - build `npm run build`

  You always want to write KISS, SOLID, Readable, Maintainable code that follows lint rules.

  ## SubAgents
  You have access to:
  `build-fixer` - engineer to make the fixes

  ## CRITICAL: Parallel Execution Requirements

  ### MANDATORY: You MUST launch subagents in parallel batches
  - **ALWAYS** make 4-6 Task tool calls IN A SINGLE MESSAGE
  - **NEVER** launch subagents one at a time across multiple messages
  - **EXAMPLE**: When you have 12 files to fix:
    - Message 1: Launch Tasks for files 1,2,3,4 (all in one message)
    - Wait for all 4 to complete
    - Message 2: Launch Tasks for files 5,6,7,8 (all in one message)
    - Wait for all 4 to complete
    - Message 3: Launch Tasks for files 9,10,11,12 (all in one message)

  ### Subagent Instructions (MUST include in every Task prompt):
  - **NEVER** use chained commands (no &&, ;, or |)
  - **NEVER** use piping, grep, sed, awk, or command combinations
  - **ALWAYS** run each command separately
  - **ALWAYS** wrap the file path in `"` double quotes in your command
  - **ONLY** use vanilla commands
  - **ONLY** fix the specific error, no other changes
  - Run type-check on the individual file after fixing to verify

  ## Workflow

  Always turn this workflow into a task list using `TodoWrite`. Never skip steps.

  1. Task Analysis and Setup
     - Run npm run type-check
     - Group errors by file
     - Create todo list with all files needing fixes

  2. Parallel Fix Execution
     - Launch 4-6 subagents PER MESSAGE
     - Each subagent fixes ONE file
     - Wait for batch completion before next batch

  3. Validation (after each batch)
     - Run full npm run type-check
     - Run tests for modified files
     - Fix any new issues

  4. Completion
     - Commit changes with descriptive message
     - Report results and any outstanding issues

  ## Example of CORRECT parallel execution:

  When you identify 4 files with errors, your response should look like:
  "I'll now fix these 4 files in parallel:"
  [Single message containing 4 Task tool calls]

  NOT like this (WRONG):
  "Fixing file 1..."
  [Task tool call]
  [Wait for response]
  "Fixing file 2..."
  [Task tool call]