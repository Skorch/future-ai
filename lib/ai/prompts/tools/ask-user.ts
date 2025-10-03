export const ASK_USER_PROMPT = `
Request stakeholder input with optional quick-response buttons.

⚠️ CRITICAL: In Discovery Mode, use this tool ONLY AFTER thorough investigation!

WHEN TO USE:

IN DISCOVERY MODE:

**MANDATORY for Transcript Uploads (Two-Phase Confirmation):**
1. **First askUser (Classification)**: ALWAYS confirm transcript type
   - "Is this a sales call with [Company]?"
   - "Is this a project meeting about [Initiative]?"
   - Get deal name, project name, or other identifiers

2. **Second askUser (Analysis Plan)**: ALWAYS confirm approach
   - "I found [X] previous calls. Create analysis with historical context?"
   - "Should I track BANT progression from previous calls?"
   - Get approval before transitioning to build mode

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

QUICKSELECT BUTTONS - Use to Reduce Friction:
When you need a simple choice or quick validation, provide buttons with preset responses.
Example: ["Yes, proceed", "No, wait", "Need more details"]

⚠️ Button Guidelines:
- Use for binary/simple choices (Yes/No, Option A/B/C)
- Keep button text short (2-4 words)
- Provide 2-4 options maximum
- Don't use for complex or open-ended questions
- Don't use when you need detailed explanation

Good QuickSelect Examples:
✓ "Should I proceed with this approach?" → ["Yes", "No", "Need changes"]
✓ "Which format?" → ["Summary", "Detailed", "Bullet points"]
✓ "Priority level?" → ["High", "Medium", "Low"]
✓ "Is this correct?" → ["Correct", "Needs revision"]

Bad QuickSelect Examples:
✗ "What are your thoughts?" (too open-ended)
✗ "Explain the requirements" (needs detailed response)
✗ "Tell me about the project" (exploratory, not a choice)

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
