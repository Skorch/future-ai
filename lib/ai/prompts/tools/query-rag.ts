export const QUERY_RAG_PROMPT = `
Search the business knowledge base for meeting insights, decisions, and requirements.

🎯 THIS IS YOUR PRIMARY DISCOVERY TOOL - USE IT FIRST AND OFTEN!

WHEN TO USE:

IN DISCOVERY MODE (Use IMMEDIATELY and REPEATEDLY):
- FIRST action when user mentions any topic/project/initiative
- BEFORE asking any questions to the user
- To find ALL available context before engaging stakeholder
- To discover information instead of requesting it
- Multiple searches with different angles on the same topic
- Even when you think there might be nothing - SEARCH ANYWAY

IN BUILD MODE (Reference):
- Find specific decisions to reference
- Look up action items and their status
- Retrieve stakeholder positions and concerns
- Check for conflicting requirements
- Find related meeting summaries

AUTOMATIC DISCOVERY SEARCHES (Do These Without Being Asked):
When user mentions any topic, IMMEDIATELY search for:
1. "[topic] meeting" - Find all related meetings
2. "[topic] decision" - Find what was already decided
3. "[topic] requirements" - Find documented requirements
4. "[topic] stakeholder" - Identify involved parties
5. "[topic] action items" - Find what's already assigned
6. "[topic] concerns" OR "[topic] risks" - Find known issues

DISCOVERY SEARCH PATTERNS:
✅ Start broad: "Project Alpha" then narrow: "Project Alpha requirements"
✅ Search for people: "[Person name] perspective on [topic]"
✅ Search timeline: "Q2 2024 [project]" or "[project] deadline"
✅ Search for problems: "[topic] concerns" or "[topic] blockers"
✅ Search for history: "original [topic]" or "initial [topic] discussion"
✅ Search variations: Try synonyms and related terms

BUILD MODE SEARCH PATTERNS:
✅ "[Stakeholder name] perspective on [topic]"
✅ "Decisions from [date range] about [project]"
✅ "Requirements approved for [initiative]"
✅ "Action items assigned to [person/team]"
✅ "Meeting outcomes for [project phase]"

EFFECTIVE BUSINESS SEARCH STRATEGY:

In Discovery Mode:
- Search broadly for related meetings and topics
- Look for historical context and past decisions
- Find patterns in stakeholder concerns
- Identify recurring themes across meetings
- Discover dependencies and related initiatives

In Build Mode:
- Search for specific decisions to cite
- Find exact quotes from stakeholders
- Look up action item status and owners
- Reference specific meeting outcomes
- Validate requirements against past agreements

SEARCH TIPS:
- Use stakeholder names to find their perspectives
- Search by date ranges for project timelines
- Look for both "agreed" and "concerns" on topics
- Include project names and initiative codes
- Search for action items by owner or status

CRITICAL RULE: SEARCH BEFORE YOU ASK!
- If you're about to use askUser, STOP and search first
- If you think "I need to know X", search for X first
- If search returns nothing, search with different terms
- Only after exhaustive searching should you use askUser

REMEMBER: You're a detective, not an interviewer.
Investigate the knowledge base thoroughly before engaging the stakeholder.
Present what you FOUND, not what you WANT TO KNOW.
`;

export default QUERY_RAG_PROMPT;
