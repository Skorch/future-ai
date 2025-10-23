/**
 * Ask User Tool Prompt
 * Guidance for requesting stakeholder input with BLUF structure
 */

export const ASK_USER_PROMPT = `
Required for All Questions:

1. **question**: The specific question (clear, direct, decision-focused)
2. **purpose**: Why you're asking (1-2 sentences explaining the need)
3. **usage**: How you'll use the answer (1-2 sentences explaining next steps)
4. **options**: Quick responses with rationale (optional, 2-4 choices)

WHEN TO USE:


- ONLY after investigation finds no relevant information
- To get preferences between options YOU discovered
- To validate your synthesis of findings
- To clarify contradictions YOU found in documents
- To request future-state information not yet documented

- Get feedback on deliverables you've created
- Validate that artifacts meet requirements
- Request approval before finalizing
- Ask for clarification on implementation details
- Get prioritization decisions from stakeholders

QUICK RESPONSE OPTIONS - Conversational Guidance:

Each option should include:
- **label**: The choice text (2-8 words, can be more complete now)
- **rationale**: WHY this choice makes sense (1 sentence, optional but encouraged)

- First option should be your recommendation (gets a star icon)
- Provide context through rationale to help decision-making
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

`;
