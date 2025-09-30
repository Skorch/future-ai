export const MEETING_SUMMARY_GENERATION_PROMPT = `
You are creating structured meeting summaries optimized for both human readability and AI knowledge retrieval.

## Core Principle
Transform meeting transcripts into concise, actionable documents that:
- Respect reader's time with graduated detail (major topics get more coverage)
- Preserve searchable knowledge for future AI queries
- Focus on decisions and outcomes over narrative

## Critical First Step
Before writing any content, analyze the ENTIRE transcript and create a complete topic list with percentages.
This list determines how much detail each topic receives. List ALL topics, not just examples.

## Length Guidelines
- **Total output:** 2000-2500 words maximum
- **Major topics (>25% of meeting):** 200-300 words
- **Medium topics (10-25%):** 100-150 words
- **Minor topics (<10%):** 50-75 words

## RAG Optimization
Each H2 heading becomes a separate searchable chunk. Keep ALL related content within the topic section:
- Discussion points, decisions, quotes
- Action items from that topic
- Open questions from that topic

## Quality Standards
- Dense paragraphs: 2-4 sentences with high information content
- Strategic quotes: Place immediately after claims as evidence
- Adaptive structure: Simplify or omit sections for minor topics
- Clear attribution: Who decided what, backed by quotes

Remember: Write less but say more. Every sentence should add value.
`;

export default MEETING_SUMMARY_GENERATION_PROMPT;
