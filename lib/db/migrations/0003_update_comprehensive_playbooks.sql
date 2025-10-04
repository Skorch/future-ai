-- Delete existing incomplete playbooks
DELETE FROM "PlaybookStep" WHERE "playbookId" IN (SELECT id FROM "Playbook" WHERE name IN ('bant-validation', 'initiative-validation'));
DELETE FROM "Playbook" WHERE name IN ('bant-validation', 'initiative-validation');
--> statement-breakpoint
-- Insert Comprehensive BANT-C Sales Call Playbook
WITH bant_playbook AS (
  INSERT INTO "Playbook" (name, description, "whenToUse", domains)
  VALUES (
    'sales-call-analysis',
    'Complete workflow for processing sales call transcripts: classify, validate BANT-C with user, find historical context, create sales-call-summary document',
    'Use this playbook when you see TRANSCRIPT_DOCUMENT markers in Discovery Mode and need to process a sales call transcript end-to-end',
    ARRAY['sales']
  )
  RETURNING id
)
INSERT INTO "PlaybookStep" ("playbookId", sequence, instruction)
SELECT id, 1, '**Classify the Transcript** (90% Confidence Rule)

Analyze the transcript content for sales call indicators:
- BANT discovery questions (Budget, Authority, Need, Timeline)
- Prospect relationship (not existing customer)
- Deal progression, objection handling
- Pricing discussions, timeline negotiations, decision-maker identification

**If <90% confident it''s a sales call:**
```
askUser({
  question: "Is this a sales call with a prospect, or a different type of meeting?",
  options: ["Sales call with prospect", "Client engagement (existing customer)", "Internal meeting", "Other"]
})
```

**If confirmed NOT a sales call:** Stop this playbook and classify appropriately.' FROM bant_playbook
UNION ALL
SELECT id, 2, '**Confirm Deal Details** (MANDATORY)

ALWAYS use askUser to confirm deal/prospect details:

```
askUser({
  question: "I''ve identified this as a sales call with [Company Name]. To provide the best analysis with historical context, can you confirm the deal details?",
  context: "I''ll search for previous calls with this prospect to track BANT progression over time.",
  options: ["[Company] - [Deal Name]", "Different company", "New prospect - no history", "Not a sales call"]
})
```

**Capture from user response:**
- Company name (validated)
- Deal/opportunity name
- Whether to search for historical context' FROM bant_playbook
UNION ALL
SELECT id, 3, '**Find Historical Context** (REQUIRED after confirmation)

Use tool chain to discover previous call analyses:

**Step 3a: List All Sales Documents**
```
listDocuments({
  documentType: "sales-call-summary"
})
```
- Review returned documents for same company/deal
- Filter by title and metadata.dealName
- Sort by date to find 2-3 most recent calls

**Step 3b: Load Recent Analyses (Optional)**
If user wants deep context, use loadDocument:
```
loadDocument({ documentId: "[uuid]" })
```
- Load 1-2 previous analyses
- Review BANT progression over time
- Note patterns in stakeholder engagement
- Identify deal momentum or stalls

**Output:** Historical context loaded for BANT validation' FROM bant_playbook
UNION ALL
SELECT id, 4, '**Extract BANT-C Facts from All Sources**

Read current transcript AND historical analyses to extract evidence for each dimension:

**Budget Evidence:**
- Direct quotes: "Our budget is...", "We''ve allocated...", "Need approval for..."
- Implicit signals: budget approval process mentioned, pricing discussions
- Historical progression: budget qualifications from previous calls

**Authority Evidence:**
- Decision makers identified: "I''m the decision maker", "I have final approval"
- Stakeholders mentioned: "I need to check with...", "Our CEO will..."
- Decision process: committee votes, approval chains

**Need Evidence:**
- Problem statements: "Our main challenge is...", "We''re losing X per month..."
- Business impact: revenue impact, efficiency gains, competitive pressure
- Pain severity: urgent vs. nice-to-have

**Timeline Evidence:**
- Target dates: "We need this by...", "Contract expires...", "Planning for Q..."
- Urgency drivers: renewal deadlines, competitive pressure, seasonal factors

**Competition Evidence:**
- Alternatives: "We''re also looking at...", "Currently using...", "Compared to..."
- Competitive position: strengths/weaknesses mentioned
- Decision criteria: what matters most to prospect' FROM bant_playbook
UNION ALL
SELECT id, 5, '**Validate Each BANT-C Dimension with User**

Present your interpretation and get user validation for EACH dimension:

**Budget Validation:**
```
askUser({
  question: "Budget Interpretation: I believe budget is [Qualified/Partial/Unknown] because [evidence]. Is this accurate?",
  context: "Evidence: ''[specific quote]'' from [source]. This suggests [interpretation].",
  options: ["Correct", "Needs revision", "Different interpretation"]
})
```

**Authority Validation:**
```
askUser({
  question: "Authority Validation: I''ve identified [names] as key stakeholders with [person] as the decision maker. Is this accurate?",
  context: "Evidence: [quotes and signals]",
  options: ["Correct", "Missing stakeholders", "Wrong decision maker", "Unclear authority"]
})
```

**Need Validation:**
```
askUser({
  question: "Need Interpretation: The core business problem appears to be [problem] with [impact]. Accurate?",
  context: "Evidence: [pain points and business impact]",
  options: ["Correct", "Different problem", "Missed key needs"]
})
```

**Timeline Validation:**
```
askUser({
  question: "Timeline Interpretation: Target decision date is [date] driven by [urgency factor]. Correct?",
  context: "Evidence: [timeline quotes and urgency signals]",
  options: ["Correct date", "Different timeline", "No clear timeline"]
})
```

**Competition Validation:**
```
askUser({
  question: "Competition Assessment: They''re evaluating [alternatives] with [our position]. Accurate?",
  context: "Evidence: [competitive mentions and positioning]",
  options: ["Correct", "Different competitors", "No alternatives mentioned"]
})
```' FROM bant_playbook
UNION ALL
SELECT id, 6, '**Consolidate Validated Facts**

Collect all user confirmations and corrections into structured summary:

**BANT-C Validated Facts (User Confirmed):**
- **Budget:** [Status - Qualified/Partial/Unknown] - [User-validated evidence]
- **Authority:** [Decision maker name(s)] - [User-validated stakeholder list and process]
- **Need:** [Core problem] - [User-validated business impact and pain severity]
- **Timeline:** [Target decision date] - [User-validated urgency drivers]
- **Competition:** [Alternatives being evaluated] - [User-validated our competitive position]

**Historical Context Notes:**
- [Summary of progression from previous calls if applicable]
- [Pattern observations from deal history]

Store this consolidated summary for use in Build Mode transition.' FROM bant_playbook
UNION ALL
SELECT id, 7, '**Transition to Build Mode**

Call setMode(''build'') with complete context:

```
setMode({
  mode: ''build'',
  description: ''Creating sales-call-summary for [Company] - [Deal Name] with validated BANT-C facts: Budget:[status], Authority:[decision maker], Need:[core problem], Timeline:[target date], Competition:[alternatives]. Historical context: [X previous calls loaded].''
})
```

**What happens in Build Mode:**
The agent will automatically create the sales-call-summary document using createDocument with:
- **Primary source:** Current transcript ID
- **Reference documents:** Historical analysis IDs (if loaded)
- **Document type:** "sales-call-summary"
- **Agent instruction:** Include all validated BANT-C facts from this playbook
- **Title:** "Sales Call - [Company] [Stage] [Date]"

The validated facts ensure accurate, user-confirmed analysis in the final document.' FROM bant_playbook;
--> statement-breakpoint
-- Insert Comprehensive Initiative/Project Meeting Playbook
WITH initiative_playbook AS (
  INSERT INTO "Playbook" (name, description, "whenToUse", domains)
  VALUES (
    'project-meeting-analysis',
    'Complete workflow for processing project/team meeting transcripts: classify, validate initiatives/progress with user, find historical context, create meeting-analysis document',
    'Use this playbook when you see TRANSCRIPT_DOCUMENT markers in Discovery Mode and need to process a project or team meeting transcript end-to-end',
    ARRAY['meeting']
  )
  RETURNING id
)
INSERT INTO "PlaybookStep" ("playbookId", sequence, instruction)
SELECT id, 1, '**Classify the Transcript Type** (90% Confidence Rule)

Analyze the transcript content to determine meeting type:

**Project/Team Meeting Indicators:**
- Internal team discussions
- Project planning, status updates, retrospectives
- Initiative/feature discussions
- Sprint planning, standups, demos
- No sales or external client context

**If <90% confident it''s a project meeting:**
```
askUser({
  question: "What type of meeting is this transcript from?",
  options: ["Project/team meeting", "Sales call", "Client engagement", "Other"]
})
```

**If confirmed NOT a project meeting:** Stop this playbook and delegate to appropriate domain.' FROM initiative_playbook
UNION ALL
SELECT id, 2, '**Confirm Project/Initiative Details** (MANDATORY)

ALWAYS use askUser to confirm project details:

```
askUser({
  question: "I''ve identified this as a project meeting about [Project/Initiative Name]. To provide the best analysis with historical context, can you confirm the details?",
  context: "I''ll search for previous meetings about this project to track progress over time.",
  options: ["[Project Name] - correct", "Different project name", "New project - no history", "Multiple projects discussed"]
})
```

**Capture from user response:**
- Project/Initiative name (validated)
- Meeting type (standup, planning, retro, etc.)
- Whether to search for historical context' FROM initiative_playbook
UNION ALL
SELECT id, 3, '**Find Historical Context** (REQUIRED after confirmation)

Use tool chain to discover previous meeting analyses:

**Step 3a: List All Meeting Documents**
```
listDocuments({
  documentType: "meeting-analysis"
})
```
- Review returned documents for same project/initiative
- Filter by title and metadata
- Sort by date to find 2-3 most recent meetings

**Step 3b: Load Recent Analyses (Optional)**
If user wants deep context:
```
loadDocument({ documentId: "[uuid]" })
```
- Load 1-2 previous meeting analyses
- Review initiative progression over time
- Track commitment completion rates
- Identify recurring blockers or patterns

**Output:** Historical context loaded for initiative validation' FROM initiative_playbook
UNION ALL
SELECT id, 4, '**Extract Initiative Facts from All Sources**

Read current transcript AND historical analyses to extract:

**Initiative/Project Identification:**
- Main initiative or project name
- Sub-projects or workstreams mentioned
- Component features being discussed
- Scope boundaries

**Progress Indicators:**
- **Completed work:** "We finished...", "Deployed...", "Shipped..."
- **In-progress work:** "Currently working on...", "In development..."
- **Blocked work:** "Blocked by...", "Waiting on...", "Can''t proceed until..."

**Commitments Made:**
- **Who:** Person making the commitment
- **What:** Specific deliverable or action
- **When:** Target completion date or sprint
- Examples: "I''ll finish the API by Friday", "Sarah will review designs by EOD"

**Blockers and Risks:**
- Resource constraints: staffing, tools, budget
- Technical challenges: integration issues, performance, bugs
- External dependencies: vendor delays, other team dependencies
- Process blockers: approval delays, unclear requirements

**Scope Changes:**
- **Additions:** New features or requirements added
- **Removals:** Features descoped or postponed
- **Changes:** Modified requirements or priorities' FROM initiative_playbook
UNION ALL
SELECT id, 5, '**Validate Each Initiative Dimension with User**

Present your interpretation and get user validation:

**Initiative Validation:**
```
askUser({
  question: "Initiative Interpretation: I identified [Project X] as the main initiative with components [Feature Y, Feature Z]. Is this accurate?",
  context: "Evidence: Meeting discussed ''[quote]''. This suggests focus on [interpretation].",
  options: ["Correct", "Different initiative", "Multiple separate initiatives", "Missing components"]
})
```

**Progress Validation:**
```
askUser({
  question: "Progress Interpretation: [Component A] is [completed/in-progress/blocked], [Component B] is [status]. Is this correct?",
  context: "Evidence: [quotes and status signals from transcript]",
  options: ["All correct", "Some statuses wrong", "Missing work items"]
})
```

**Commitments Validation:**
```
askUser({
  question: "Commitment Validation: I tracked these action items: [list with owner and date]. Did I capture everything accurately?",
  context: "Commitments found: [detailed list]",
  options: ["Complete and accurate", "Missing commitments", "Wrong owners or dates"]
})
```

**Blockers Validation:**
```
askUser({
  question: "Blocker Assessment: Key blockers appear to be [X, Y, Z] impacting [components]. Accurate?",
  context: "Evidence: [blocker mentions and impact]",
  options: ["Correct blockers", "Missing blockers", "Different priorities", "No major blockers"]
})
```

**Scope Changes Validation:**
```
askUser({
  question: "Scope Change Interpretation: Scope changed to include [additions] and remove [removals]. Is this correct?",
  context: "Evidence: [scope change discussions]",
  options: ["Correct", "Different changes", "No scope changes"]
})
```' FROM initiative_playbook
UNION ALL
SELECT id, 6, '**Consolidate Validated Facts**

Collect all user confirmations and corrections into structured summary:

**Initiative Validated Facts (User Confirmed):**
- **Initiative/Project:** [User-validated project/initiative name and components]
- **Progress Status:**
  - Completed: [User-validated completed items]
  - In Progress: [User-validated in-progress items with status]
  - Blocked: [User-validated blocked items with blockers]
- **Commitments:** [X action items tracked]
  - [Owner]: [Task] by [Date]
  - [Owner]: [Task] by [Date]
  - [Repeat for all validated commitments]
- **Blockers:** [User-validated obstacles and impact]
  - Critical: [blocker and affected work]
  - [Additional blockers]
- **Scope Changes:** [User-validated changes]
  - Added: [new features/requirements]
  - Removed: [descoped items]

**Historical Context Notes:**
- [Summary of progression from previous meetings if applicable]
- [Commitment completion trends]
- [Recurring blocker patterns]

Store this consolidated summary for use in Build Mode transition.' FROM initiative_playbook
UNION ALL
SELECT id, 7, '**Transition to Build Mode**

Call setMode(''build'') with complete context:

```
setMode({
  mode: ''build'',
  description: ''Creating meeting-analysis for [Project Name] with validated facts: Initiative:[name], Progress:[X completed, Y in-progress, Z blocked], [N] commitments tracked, [M] blockers identified. Historical context: [X previous meetings loaded].''
})
```

**What happens in Build Mode:**
The agent will automatically create the meeting-analysis document using createDocument with:
- **Primary source:** Current transcript ID
- **Reference documents:** Historical meeting analysis IDs (if loaded)
- **Document type:** "meeting-analysis"
- **Agent instruction:** Include all validated initiative facts from this playbook
- **Title:** "Meeting - [Project] [Meeting Type] [Date]"

The validated facts ensure accurate, user-confirmed analysis with proper tracking of commitments and blockers.' FROM initiative_playbook;
