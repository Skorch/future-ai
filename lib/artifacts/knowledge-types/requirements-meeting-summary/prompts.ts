/**
 * Prompts for requirements meeting summary knowledge processing
 */

export const REQUIREMENTS_MEETING_SUMMARY_PROMPT = `Create a focused requirements meeting summary with the following structure:

## Meeting Context
- Date, participants, and purpose
- Background and goals for the meeting

## Functional Requirements
- Features and capabilities discussed
- User stories or use cases
- Priority and importance

## Technical Requirements
- Technical constraints or specifications
- Integration points
- Performance or scalability requirements

## Non-Functional Requirements
- Security considerations
- Compliance requirements
- Usability and accessibility

## Dependencies & Blockers
- External dependencies identified
- Potential blockers or risks
- Third-party integrations

## Assumptions & Open Questions
- Assumptions made during discussion
- Questions that need answers
- Areas requiring further clarification

## Next Steps
- Action items and owners
- Follow-up meetings or decisions needed
- Timeline considerations

Format your summary with clear sections and bullet points for easy reference.`;
