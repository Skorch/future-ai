export const ASK_USER_PROMPT = `
Request stakeholder input with optional quick-response buttons.

⚠️ CRITICAL: In Discovery Mode, use this tool ONLY AFTER searching with queryRAG and reviewing documents!

WHEN TO USE:

IN DISCOVERY MODE (Last Resort Tool - After Investigation):
- ONLY after searching (queryRAG) finds no relevant information
- To get preferences between options YOU discovered
- To validate your synthesis of findings
- To clarify contradictions YOU found in documents
- To get forward-looking decisions not yet documented
- When user explicitly says "ask me questions"

IN BUILD MODE (Validation Tool):
- To confirm document meets stakeholder needs
- To validate action items and owners
- To get approval on deliverables
- When conflicting requirements need resolution
- To ensure alignment with business goals

DISCOVERY EXAMPLES (After Investigation):
✅ "I found 3 meetings about Project X. Should we prioritize the MVP or full implementation?"
   Options: ["MVP first", "Full implementation", "Phased approach", "Need more context"]
✅ "Based on past meetings, stakeholders are Sales and Engineering. Anyone else to include?"
   Options: ["Yes, also Marketing", "Yes, also Finance", "No, that's complete", "Let me check"]
✅ "I see conflicting timelines in two documents. Which is correct: Q2 or Q3?"
   Options: ["Q2 is correct", "Q3 is correct", "Both - different phases", "Neither - it changed"]
✅ "I've analyzed requirements from 5 meetings. Is [summary] accurate?"
   Options: ["Yes, exactly right", "Mostly, with changes", "Missing key points", "Let me clarify"]

BUILD MODE EXAMPLES:
✅ "Should I prioritize the executive summary or detailed requirements?"
   Options: ["Executive summary", "Detailed requirements", "Both equally", "Let me explain"]
✅ "I've drafted the meeting summary. Ready for your review?"
   Options: ["Yes, show me", "Send to stakeholders", "Need changes first"]
✅ "Which stakeholder perspective should I emphasize?"
   Options: ["Customer impact", "Financial implications", "Operational efficiency", "Balanced view"]

HOW TO USE EFFECTIVELY:
- In Discovery: Focus on understanding the "why" behind requests
- In Build Mode: Validate alignment with requirements
- Always explain the business context for your question
- Provide 2-4 options for discrete business decisions
- First option should be most likely/recommended (shows with ⭐)
- Keep options brief and business-focused

BUSINESS QUESTIONS TO PRIORITIZE:
✓ Stakeholder identification and concerns
✓ Success criteria and KPIs
✓ Timeline and milestone validation
✓ Risk and dependency assessment
✓ Decision approval and sign-off
✓ Action item ownership and deadlines

ANTI-PATTERNS TO AVOID:
❌ Asking questions BEFORE searching with queryRAG
❌ Asking "Who are the stakeholders?" (search meeting attendees instead)
❌ Asking "What was decided?" (find in meeting summaries instead)
❌ Asking "What's the timeline?" (check action items instead)
❌ Asking about past events (search for them instead)
❌ Using askUser as your first tool in discovery

GOOD PATTERN:
1. Search for context (queryRAG)
2. Review findings (loadDocument)
3. Present what you found
4. Ask ONLY about gaps or validation

IMPORTANT: This is your primary method for stakeholder engagement.
Every major assumption should be validated through this tool.
The stakeholder's response guides your next steps.
`;

export default ASK_USER_PROMPT;
