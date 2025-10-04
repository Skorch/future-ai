CREATE TABLE "Playbook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"whenToUse" text,
	"domains" text[] NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Playbook_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "PlaybookStep" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playbookId" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"instruction" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "PlaybookStep_playbookId_sequence_unique" UNIQUE("playbookId","sequence")
);
--> statement-breakpoint
ALTER TABLE "PlaybookStep" ADD CONSTRAINT "PlaybookStep_playbookId_Playbook_id_fk" FOREIGN KEY ("playbookId") REFERENCES "public"."Playbook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "playbook_steps_idx" ON "PlaybookStep" USING btree ("playbookId","sequence");--> statement-breakpoint
-- Seed Playbook Data
-- Insert BANT-C Validation Playbook
WITH bant_playbook AS (
  INSERT INTO "Playbook" (name, description, "whenToUse", domains)
  VALUES (
    'bant-validation',
    'Validate Budget, Authority, Need, Timeline, Competition for sales calls',
    'Use this playbook when: (1) Sales transcript uploaded and classified with ≥90% confidence, (2) User confirms transcript is a sales call, (3) Before creating any sales-call-summary document, (4) When analyzing deal progression across multiple calls',
    ARRAY['sales']
  )
  RETURNING id
)
INSERT INTO "PlaybookStep" ("playbookId", sequence, instruction)
SELECT id, 1, '**Extract BANT-C Facts from Sources**

Read the current transcript thoroughly. For each BANT-C dimension, extract:
- Direct quotes as evidence
- Speaker attribution
- Confidence level (explicit vs. implied)

Budget indicators: "Our budget is...", "We''ve allocated...", "Need approval for..."
Authority indicators: "I''m the decision maker", "I need to check with...", "Our CEO will..."
Need indicators: "Our main challenge is...", "We''re losing X per month..."
Timeline indicators: "We need this by...", "Contract expires...", "Planning for Q..."
Competition indicators: "We''re also looking at...", "Currently using...", "Compared to..."'
FROM bant_playbook
UNION ALL
SELECT id, 2, '**Create Validation Checklist**

For each BANT-C dimension with found evidence:
- Formulate your interpretation
- Identify the strongest supporting quote
- Note confidence level (High/Medium/Low)

Format as:
BUDGET: [Status] - Evidence: "[quote]" - Confidence: [level]
AUTHORITY: [Status] - Evidence: "[quote]" - Confidence: [level]
[Continue for Need, Timeline, Competition]'
FROM bant_playbook
UNION ALL
SELECT id, 3, '**Validate Each Dimension with User**

Use askUser to validate EACH dimension separately:

For Budget:
`askUser({ question: "Budget Validation: Based on the transcript, I believe budget is [status] because [evidence]. Is this accurate?", options: ["Correct", "Partially correct", "Different interpretation"] })`

For Authority:
`askUser({ question: "Authority Validation: I''ve identified [names] as key stakeholders with [person] as decision maker. Accurate?", options: ["Correct", "Missing stakeholders", "Wrong decision maker"] })`

[Continue pattern for Need, Timeline, Competition]'
FROM bant_playbook
UNION ALL
SELECT id, 4, '**Consolidate Validated Facts**

Compile user-validated information into structured summary:

**BANT-C Validated Facts (User Confirmed):**
- Budget: [Status] - [Validated evidence]
- Authority: [Decision maker] - [Stakeholders list]
- Need: [Problem] - [Quantified impact]
- Timeline: [Target date] - [Driver]
- Competition: [Alternatives] - [Our position]

Include any corrections from user validation.'
FROM bant_playbook
UNION ALL
SELECT id, 5, '**Transition to Build Mode**

Call setMode(''build'') with validated facts:

`setMode({ mode: ''build'', description: ''Creating sales-call-summary for [Company] with validated BANT-C facts: Budget:[status], Authority:[status], Need:[status], Timeline:[status], Competition:[status]'' })`

In Build Mode, include validated facts in createDocument agentInstruction parameter.'
FROM bant_playbook;--> statement-breakpoint
-- Insert Initiative Validation Playbook
WITH initiative_playbook AS (
  INSERT INTO "Playbook" (name, description, "whenToUse", domains)
  VALUES (
    'initiative-validation',
    'Validate project initiatives, progress, and commitments for meeting analysis',
    'Use this playbook when: (1) Project meeting transcript uploaded and classified with ≥90% confidence, (2) User confirms transcript is a project/team meeting, (3) Before creating any meeting-analysis document, (4) When tracking project progress across multiple meetings',
    ARRAY['meeting']
  )
  RETURNING id
)
INSERT INTO "PlaybookStep" ("playbookId", sequence, instruction)
SELECT id, 1, '**Extract Initiative Facts**

Read the transcript and extract:

Initiative/Project Identification:
- Main initiative or project name
- Sub-projects or workstreams mentioned
- Component features being discussed

Progress Indicators:
- "We completed..." (achievements)
- "Currently working on..." (in-progress)
- "Blocked by..." (impediments)

Commitments:
- "I will..." (personal commitments)
- "By [date]..." (deadlines)
- "Assigned to..." (ownership)

Blockers and Risks:
- Resource constraints
- Dependencies
- Technical challenges'
FROM initiative_playbook
UNION ALL
SELECT id, 2, '**Create Validation Checklist**

Organize findings:

INITIATIVES:
- Primary: [main initiative]
- Components: [features/workstreams]

PROGRESS:
- Completed: [list with evidence]
- In Progress: [list with status]

COMMITMENTS:
- [Owner]: [Task] by [Date]

BLOCKERS:
- Critical: [blocker and impact]

SCOPE CHANGES:
- Additions: [new items]
- Removals: [descoped items]'
FROM initiative_playbook
UNION ALL
SELECT id, 3, '**Validate with User**

Execute validation sequence:

For Initiative:
`askUser({ question: "Initiative Validation: I identified [X] as the primary initiative with components [Y, Z]. Accurate?", options: ["Correct", "Different initiative", "Multiple initiatives"] })`

For Progress:
`askUser({ question: "Progress Validation: [Component A] is [status], [Component B] is [status]. Correct?", options: ["All correct", "Partially correct", "Different status"] })`

For Commitments:
`askUser({ question: "Commitment Validation: I tracked these action items: [list]. Complete and accurate?", options: ["Complete list", "Missing items", "Wrong owners"] })`'
FROM initiative_playbook
UNION ALL
SELECT id, 4, '**Consolidate Validated Facts**

Create summary:

**Initiative Validated Facts (User Confirmed):**
- Initiative: [validated name]
- Progress: [validated status]
- Commitments: [X] action items tracked
- Blockers: [validated blockers]
- Scope Changes: [validated changes]'
FROM initiative_playbook
UNION ALL
SELECT id, 5, '**Transition to Build Mode**

Call setMode(''build''):

`setMode({ mode: ''build'', description: ''Creating meeting-analysis for [Project] with validated facts: Initiative:[name], Progress:[summary], [X] commitments, [Y] blockers'' })`

Use validated facts in createDocument agentInstruction.'
FROM initiative_playbook;