export const ASK_USER_PROMPT = `
Request stakeholder input with optional quick-response buttons using BLUF (Bottom Line Up Front) structure.

⚠️ CRITICAL: In Discovery Mode, use this tool ONLY AFTER thorough investigation!

BLUF STRUCTURE - Required for All Questions:

1. **question**: The specific question (clear, direct, decision-focused)
2. **purpose**: Why you're asking (1-2 sentences explaining the need)
3. **usage**: How you'll use the answer (1-2 sentences explaining next steps)
4. **options**: Quick responses with rationale (optional, 2-4 choices)

WHEN TO USE:

IN DISCOVERY MODE:

**MANDATORY for Transcript Uploads (Two-Phase Confirmation):**
1. **First askUser (Classification)**: ALWAYS confirm transcript type
   - question: "Is this a sales call with [Company]?"
   - purpose: "I need to classify this transcript to apply the right analysis framework"
   - usage: "This determines whether I analyze for BANT criteria or project milestones"
   - options: [
       { label: "Yes, sales call", rationale: "Apply BANT analysis and deal tracking" },
       { label: "No, project meeting", rationale: "Focus on action items and decisions" }
     ]

2. **Second askUser (Analysis Plan)**: ALWAYS confirm approach
   - question: "I found [X] previous calls. Create analysis with historical context?"
   - purpose: "Historical context provides deeper insights but requires more processing"
   - usage: "If yes, I'll compare themes and track progression across all calls"
   - options: [
       { label: "Yes, include history", rationale: "See patterns and evolution over time" },
       { label: "No, just this call", rationale: "Faster, focused on current discussion" }
     ]

**For Other Investigations (Last Resort - After Investigation):**
- ONLY after investigation finds no relevant information
- To get preferences between options YOU discovered
- To validate your synthesis of findings
- To clarify contradictions YOU found in documents
- To request future-state information not yet documented

IN BUILD MODE (More Flexible):
- Get feedback on deliverables you've created
- Validate that artifacts meet requirements
- Request approval before finalizing
- Ask for clarification on implementation details
- Get prioritization decisions from stakeholders

QUICK RESPONSE OPTIONS - Conversational Guidance:

Each option should include:
- **label**: The choice text (2-8 words, can be more complete now)
- **rationale**: WHY this choice makes sense (1 sentence, optional but encouraged)

⚠️ Option Guidelines:
- First option should be your recommendation (gets a star icon)
- Provide context through rationale to help decision-making
- Use for binary/simple choices or multiple-choice decisions
- 2-4 options maximum
- Rationale helps user understand implications of each choice

Good Option Examples:
✓ { label: "Accelerate VP discovery", rationale: "Fastest path to budget approval, addresses critical authority gap" }
✓ { label: "Create 2026 urgency", rationale: "Leverages planning cycle deadline for natural momentum" }
✓ { label: "Long-term enterprise strategy", rationale: "Positions for larger deal but extends timeline significantly" }
✓ { label: "All three approaches", rationale: "Comprehensive but resource-intensive" }

Bad Option Examples:
✗ { label: "Yes" } (too brief, no context)
✗ { label: "What do you think?" } (not a choice)
✗ { label: "Tell me more" } (open-ended, defeats quick response purpose)

ANTI-PATTERNS - Things You Should NEVER Ask:

Information You Can Discover:
❌ Asking "Who are the stakeholders?" (search meeting attendees instead)
❌ Asking "What was decided?" (find in meeting summaries instead)
❌ Asking "What's the timeline?" (check action items instead)
❌ Asking "What are the requirements?" (find in documents instead)
❌ Asking about project history (investigate first)
❌ Using askUser as your first tool in discovery

GOOD PATTERN:
1. Investigate existing knowledge
2. Review and synthesize findings
3. Present what you found
4. Ask ONLY about gaps or validation

BAD PATTERN:
❌ Asking "What should I know about Project X?" without any investigation
❌ Using askUser before checking what information exists
❌ Asking broad questions when specific documents are available
❌ Requesting information that's likely documented

Questions That ARE Appropriate:
✅ "Based on my findings [X], should we prioritize [A] or [B]?"
✅ "I found conflicting information about [Y]. Which is current?"
✅ "My analysis shows [Z]. Does this align with your expectations?"
✅ "For the future state, do you prefer [option A] or [option B]?"
✅ "I couldn't find information about [specific gap]. Can you clarify?"

REMEMBER:
- Investigation before interrogation
- Present findings before asking questions
- Validate understanding, don't outsource discovery
- Use QuickSelect to streamline simple decisions
`;

export default ASK_USER_PROMPT;
