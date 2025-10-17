-- Custom SQL migration file, put your code below! --

-- Seed ArtifactType and Domain tables with prompt data
-- Uses WITH...RETURNING to capture generated UUIDs for FK references

-- Step 1: Insert all ArtifactType records and capture their IDs
WITH inserted_artifact_types AS (
  INSERT INTO "ArtifactType" (
    "category",
    "title",
    "description",
    "instructionPrompt",
    "template"
  ) VALUES
  -- Sales Domain Artifacts
  (
    'objective',
    'Sales Strategy',
    'Strategic sales recommendations and probability assessments for deals',
    'You are a strategic sales advisor specializing in B2B deal strategy, competitive positioning, and revenue acceleration.

## Your Strategic Analysis Task

Generate strategic recommendations and probability assessments based on sales call analyses. This document provides **speculative analysis, recommendations, and strategic guidance** that complements the factual sales-analysis document.

## Core Philosophy

**Sales-Analysis = What Happened (Facts)**
**Sales-Strategy = What Should Happen (Recommendations)**

This document should answer:
- What''s our probability of winning this deal?
- What are the critical risks and how do we mitigate them?
- What should the sales team do next and why?
- How does this deal compare to similar opportunities?
- What positioning adjustments should we make?',
    '# Sales Strategy Recommendation

**Deal:** [Company Name - Deal Name] | **Stage:** [Current Stage] | **Analysis Date:** [MM/DD/YYYY]

---

## Executive Assessment

### Deal Probability: [XX]%
**Rationale:** [2-3 sentences explaining probability assessment with specific BANT evidence]'
  ),
  (
    'summary',
    'Sales Call Summary',
    'Factual summary of sales call transcripts with BANT analysis',
    'Create a focused sales call summary with the following structure:

## Customer Information
- Company and key contacts
- Current situation and context

## Needs & Pain Points
- Problems they''re trying to solve
- Challenges they''re facing
- Impact of current situation

## Solution Discussion
- Product/service features discussed
- How our solution addresses their needs
- Value proposition presented',
    NULL
  ),
  (
    'punchlist',
    'Sales Punchlist',
    'Track BANT-C qualification progress and deal risks',
    'You are tracking the discovery progress for a Sales Strategy document.

## WHAT THIS DOCUMENT NEEDS TO DISCOVER

A complete Sales Strategy requires clarity on:

**BANT-C Qualification**
- Budget: What''s their budget? Is it allocated? Who controls it?
- Authority: Who''s the economic buyer? What''s the approval process?
- Need: How urgent is the problem? What''s the cost of inaction?
- Timeline: When do they need to decide? What drives the timeline?
- Competition: What alternatives are they considering? Why?',
    NULL
  ),
  (
    'context',
    'Sales Workspace Context',
    'Workspace-level sales intelligence and company information',
    '## Sales Domain - Workspace Context Guidelines

When updating workspace context for a sales domain workspace, focus on information that applies **across all deals** in this workspace. Individual deal details should NOT be in workspace context.

### ✅ DO Capture in Workspace Context:

**Company/Organization Identity:**
- User''s company name and role
- What products/services they sell
- Industry and market positioning
- Company size, structure, and team composition',
    NULL
  ),
  (
    'context',
    'Sales Objective Context',
    'Deal-specific context and stakeholder information',
    'Focus on THIS specific deal:
- Company name and key stakeholders (names, roles, influence)
- Deal size, budget, timeline, and decision process
- Requirements, pain points, and success criteria
- Competition and our competitive position
- Current status, momentum, and next steps

Never include:
- Specific TODOs or action items for the deal',
    NULL
  ),
  -- Project Domain Artifacts
  (
    'objective',
    'Business Requirements',
    'Comprehensive business requirements documentation from discovery sessions',
    'You are creating a comprehensive Business Requirements Document from meeting transcripts and discovery documentation.

## BRD Creation Principles

1. **Precision Over Generalization**: Always specify exact data sources, never use generic terms
2. **Evidence-Based Documentation**: Only include what is explicitly stated in source materials
3. **Clear Acceptance Criteria**: Each deliverable must have measurable acceptance criteria',
    '# Business Requirements Document

## 1. Overview

### Business Use Case
{%Summarize the overarching business use case in 1-2 paragraphs%}

### Business Value
{%Describe the specific value this delivers to the client and what decisions they will make with this data%}'
  ),
  (
    'summary',
    'Requirements Meeting Summary',
    'Summary of requirements gathering meetings and discussions',
    'Create a focused requirements meeting summary with the following structure:

## Meeting Context
- Date, participants, and purpose
- Background and goals for the meeting

## Functional Requirements
- Features and capabilities discussed
- User stories or use cases
- Priority and importance',
    NULL
  ),
  (
    'punchlist',
    'Project Punchlist',
    'Track project requirements discovery and unknowns',
    'You are tracking the discovery progress for a Business Requirements Document.

## WHAT THIS DOCUMENT NEEDS TO DISCOVER

A complete BRD requires clarity on:

**Technical Feasibility**
- Can each requirement be implemented with available systems?
- Are there technical blockers or limitations?
- What are the performance implications?',
    NULL
  ),
  (
    'context',
    'Project Workspace Context',
    'Workspace-level project management and organizational information',
    '## Meeting Intelligence Domain - Workspace Context Guidelines

When updating workspace context for a meeting intelligence domain workspace, focus on information that applies **across all meetings and projects** in this workspace.

### ✅ DO Capture in Workspace Context:

**Organization Identity:**
- Company/team name and mission
- What the organization does (consulting, agency, product dev, etc.)
- Industry and service offerings
- Team structure and roles',
    NULL
  ),
  (
    'context',
    'Project Objective Context',
    'Project-specific goals, requirements, and status tracking',
    'Focus on THIS specific project/product:
- Project goals and key stakeholders
- Requirements and technical approach
- Timeline, milestones, and dependencies
- Current progress, status, and blockers
- Decisions made and open questions',
    NULL
  )
  RETURNING
    "id",
    "category",
    "title"
),
-- Step 2: Insert Domain records using the captured artifact type IDs
inserted_domains AS (
  INSERT INTO "Domain" (
    "title",
    "description",
    "systemPrompt",
    "defaultObjectiveArtifactTypeId",
    "defaultSummaryArtifactTypeId",
    "defaultPunchlistArtifactTypeId",
    "defaultWorkspaceContextArtifactTypeId",
    "defaultObjectiveContextArtifactTypeId"
  )
  SELECT
    'Sales Intelligence',
    'Sales call analysis, deal tracking, and BANT qualification for B2B sales teams',
    '## Sales Intelligence & Deal Management

You specialize in sales call analysis, deal tracking, and BANT qualification.

### Sales Call Workflow

When you see TRANSCRIPT_DOCUMENT markers:

**Use Structured Playbooks for Consistency**

Check your available playbooks using the getPlaybook tool.',
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Sales Strategy'),
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Sales Call Summary'),
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Sales Punchlist'),
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Sales Workspace Context'),
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Sales Objective Context')

  UNION ALL

  SELECT
    'Project Intelligence',
    'Meeting analysis, requirements gathering, and project documentation for consulting and development teams',
    '## Meeting & Transcript Intelligence

You have access to uploaded transcripts and should help users extract value from them.

### When You See TRANSCRIPT_DOCUMENT Markers

**Use Structured Playbooks for Consistency**

Check your available playbooks using the getPlaybook tool.',
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Business Requirements'),
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Requirements Meeting Summary'),
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Project Punchlist'),
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Project Workspace Context'),
    (SELECT "id" FROM inserted_artifact_types WHERE "title" = 'Project Objective Context')

  RETURNING "id", "title"
)
-- Step 3: Return summary of what was inserted
SELECT
  (SELECT COUNT(*) FROM inserted_artifact_types) as artifact_types_created,
  (SELECT COUNT(*) FROM inserted_domains) as domains_created;
