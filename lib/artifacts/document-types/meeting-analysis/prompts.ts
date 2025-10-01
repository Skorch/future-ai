export const MEETING_SUMMARY_PROMPT = `You are creating a meeting memory that serves as both a human-readable summary and an AI-searchable knowledge artifact.

## HOW TO USE THIS TEMPLATE

<think>
Before writing anything, analyze the entire transcript:
1. List all topics discussed with approximate time percentages
2. Classify each topic as Major (>25%), Medium (10-25%), or Minor (<10%)
3. Calculate word budget based on the output limit you're given
4. Choose the appropriate component template for each topic
5. Plan which details to include vs exclude to stay within limits
</think>

### Component Selection Guide
- **Major Topics**: Use the Major Topic Component (see below)
- **Medium Topics**: Use the Medium Topic Component (see below)
- **Minor Topics**: Use the Minor Topic Component (see below)
- **Micro Topics (<3%)**: Omit unless they contain decisions or action items

### Writing Process
1. Start with the topic list and percentages
2. For each topic, copy the appropriate component template
3. Fill in ONLY the placeholder content - don't expand beyond the shown space
4. If you're exceeding the placeholder length, CUT rather than continue
5. Verify each section matches the component template's density

## CRITICAL RULE: Only Use Information From The Transcript
- **NEVER fabricate information not explicitly present in the transcript**
- **Every statement must be directly traceable to the source transcript**
- **If information is missing, note it rather than guessing**

## Core Principle: Graduated Detail by Importance

First, identify ALL topics discussed and assign percentages based on time spent.
This upfront assessment determines the detail level for each section.

**Critical for RAG Indexing:**
Each H2 section will be indexed as a separate chunk. ALWAYS keep:
- All discussion points within the topic's H2 section
- Action items within their originating topic section
- Open questions within their relevant topic section
- Topic-specific quotes and decisions within that section

## Writing Style
- **Paragraphs**: 2-4 sentences each, dense with information
- **Quotes**: Place immediately after relevant statements as evidence
- **Focus**: Decisions and outcomes over narrative
- **Attribution**: Who decided what, backed by quotes

## What to Capture
- **Decisions** with supporting quotes showing consensus
- **Key metrics**, specifications, and technical details
- **Unresolved questions** and contradictions (mark with ❓ or ⚠️)
- **Action items** that arose from THIS meeting's decisions only
- **Critical insights** or pivotal realizations

## What to Omit
- Play-by-play narration of who said what
- Pre-existing work mentioned in passing
- Repetitive discussion that didn't advance understanding
- Excessive structural sections for minor topics

## Action Items Rules
ONLY include action items that were CREATED during this meeting:
- Must result from a decision IN THIS MEETING
- Must have specific owner (or flag with ⚠️)
- Must have clear deliverable and due date

## Critical Thinking Markers
- ❓ **Unresolved:** Questions raised but not answered
- ⚠️ **Risk:** Contradictions or concerns identified
- 🔴 **Ambiguous:** Vague agreements needing clarification
- **Gap:** Missing information explicitly noted

## Quality Check
✓ Is length proportional to topic importance?
✓ Are quotes proving decisions, not decorating?
✓ Can someone understand what was decided and why?
✓ Would AI find enough context to answer questions?

Remember: Write less but say more. Every sentence should add value.

## COMPONENT TEMPLATES

Decide on the component template based on topic importance:

### Major Topic Component (> 20min of time)
Use this exact structure and density:

\`\`\`markdown
## [Topic Name]

### Key Discussion
[First paragraph about this length demonstrating the core problem or challenge with specific
metrics and numbers. This shows roughly how much content fits in a major topic paragraph -
about two to three sentences that pack in the essential context without any fluff or setup.]

[Second paragraph similar length covering the discussion, debate, or analysis that happened.
Again notice this is about two to three sentences focusing on what was actually decided or
discovered rather than describing the conversation process or who said what when.]

[Optional third paragraph if needed for outcomes, but only if the topic truly dominated the
meeting at 30%+ of time. Otherwise stick to two paragraphs and move the outcome up into
the second paragraph to maintain the tight focus you see demonstrated in this template.]

> "[Key quote that proves the decision was made - keep under 20 words]" - Name

### Decision
[One clear sentence stating what was decided]

### Action Items
- @Owner will [specific task] by [date]
- @Owner2 will [another task] by [date]

### Unresolved Questions
- ❓ [Unresolved question from this topic]


### Medium Topic Component (10-20 min of time)
Use this exact structure and density:

\`\`\`markdown
## [Topic Name]

### Key Discussion
[Single paragraph covering context and discussion in about this much space. Notice how this
is roughly half the length of a major topic - about three to four sentences total that capture
both the problem and the key points of discussion in one flowing paragraph.]

[Second paragraph with the resolution, outcome, or key learning. Again about two to three
sentences that state what was decided or discovered without excessive explanation.]

> "[Supporting quote under 15 words]" - Name


### Decision
[One clear sentence stating what was decided]

### Action Items
- @Owner will [specific task] by [date]
- @Owner2 will [another task] by [date]

### Unresolved Questions
- ❓ [Unresolved question from this topic]

\`\`\`

### Minor Topic Component (< 10min of time>)
Use this exact structure and density:

\`\`\`markdown
## [Topic Name]

### Key Discussion
[Single paragraph about this length - roughly two to three sentences that capture the
entire topic. State the issue and resolution together. Skip quotes unless critical.]

### Decision
[One clear sentence stating what was decided]

### Action Items
- @Owner will [specific task] by [date]
- @Owner2 will [another task] by [date]

### Unresolved Questions
- ❓ [Unresolved question from this topic]
\`\`\`

END OF COMPONENT TEMPLATES`;

export const MEETING_SUMMARY_TEMPLATE = `# Meeting Summary: [Main outcome or key decision]

**Date:** [Date] • **Participants:** [Names] • **Duration:** [Time]

## Summary
[One paragraph: What was accomplished, key decisions, and immediate next steps. Make this scannable and action-oriented.]

### Topics Covered
[- {Topic Name} ({size} - {size taken})]
[- {Topic Name} ({size} - {size taken})]
[...]

---

## {First Topic}
[USE THE {COMPONENT TEMPLATES} that matches the topic size: 20+min (major), 10-20min (medium), <10min (minor)]
[FOLLOW THE COMPONENT TEMPLATES EXACTLY ]

## {Second Topic}
[USE THE {COMPONENT TEMPLATES} that matches the topic size]
[FOLLOW THE COMPONENT TEMPLATES EXACTLY ]

## {... Topic}
[USE THE {COMPONENT TEMPLATES} that matches the topic size]
[FOLLOW THE COMPONENT TEMPLATES EXACTLY ]

---

## Consolidated View for Executive Review

### All Action Items
| Owner | Action | Topic | Due | Priority |
|-------|--------|-------|-----|----------|
| @Name | Specific deliverable | [Topic name] | Date | High |
| ⚠️ TBD | Task needing assignment | [Topic name] | Date | **NEEDS OWNER** |

### Critical Open Questions
- ❓ **[Topic]:** [Most important unresolved question]
- ⚠️ **[Topic]:** [Highest risk identified]`;
