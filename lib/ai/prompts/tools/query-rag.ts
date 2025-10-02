export const QUERY_RAG_PROMPT = `
Search the knowledge base to find specific content, quotes, and details within documents.

🎯 USE CASE: Finding needles in the haystack

QueryRAG searches CONTENT (text within documents) using semantic search.
For structured metadata (document types, dates, titles), use listDocuments instead.

WHEN TO USE queryRAG:
- Find specific quotes to support your analysis
- Search for mentions of specific topics across all documents
- Validate assumptions with evidence from source material
- Find detailed discussions buried in transcripts
- Discover related content you didn't know existed

WHEN NOT TO USE queryRAG:
- Finding all documents of a certain type → Use listDocuments
- Getting document metadata (dates, titles, IDs) → Use listDocuments
- Loading complete document content → Use loadDocument
- Listing available documents → Use listDocuments

TYPICAL WORKFLOW (queryRAG comes AFTER list/load):
1. listDocuments → See what's available (metadata: types, dates, titles)
2. loadDocument → Read relevant summaries (structured understanding)
3. Synthesize → Form understanding from summaries
4. queryRAG → Find supporting quotes/details to validate or enrich

EFFECTIVE SEARCH PATTERNS:
✅ Specific quotes: "What did [person] say about [topic]?"
✅ Topic mentions: Find all discussions of "[specific initiative]"
✅ Evidence hunting: "Why was [decision] made?" (find rationale in transcripts)
✅ Pattern discovery: "concerns about [issue]" across multiple meetings
✅ Validation: "Was [assumption] discussed?" (verify your synthesis)

SEARCH TIPS:
- Use stakeholder names to find their specific statements
- Search for decision rationale, not just outcomes
- Look for both supporting and contradicting evidence
- Include specific terminology and project names
- Try variations if first search doesn't find expected content

REMEMBER: QueryRAG is for CONTENT search. For document discovery, start with listDocuments.
`;

export default QUERY_RAG_PROMPT;
