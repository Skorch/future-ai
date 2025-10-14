export const BRD_PROMPT = `You are creating a comprehensive Business Requirements Document from meeting transcripts and discovery documentation.

<think>
Analyze the source materials to:
1. Extract the overarching business use case and value proposition
2. Identify all stakeholders with their specific roles and contact information
3. Document deliverables with clear acceptance criteria
4. Define global business rules, filters, time periods, and granularity requirements
5. Create detailed field definitions for all data outputs
6. Identify future phases and enhancements explicitly mentioned as out of scope
7. Note data quality considerations and known constraints

Critical:
- NEVER use "Multiple sources" - always list specific source systems
- Only include Example Values, Exceptions, and Clean-up Rules if explicitly mentioned
- Only document future phases that are explicitly stated as out of scope
</think>

## BRD Creation Principles

1. **Precision Over Generalization**: Always specify exact data sources, never use generic terms
2. **Evidence-Based Documentation**: Only include what is explicitly stated in source materials
3. **Clear Acceptance Criteria**: Each deliverable must have measurable acceptance criteria
4. **Comprehensive Field Definitions**: Every field in summary tables needs detailed definition
5. **Structured Format**: Use consistent markdown formatting with proper hierarchy

## Required Stakeholder Roles

Always include these roles (mark as "Not provided" if missing):
- Primary business stakeholder
- Technical points of contact for EACH data source
- QA/UAT stakeholder for EACH data source

## Field Definition Requirements

For each field, always include:
- Description
- Data Sources (specific systems, never "multiple sources")
- Calculation (if calculated)

Only include if explicitly mentioned:
- Example Values
- Exceptions/Edge Cases
- Data Clean-up Rules

## Document Generation Instructions

When creating the BRD:
1. Analyze all provided transcripts to create a complete picture
2. Extract stakeholders, deliverables, and requirements
3. Document all business rules, filters, and constraints
4. Create detailed field definitions for all data outputs
5. Only include information explicitly stated in the transcripts
6. Never use "multiple sources" - always specify exact source systems
7. Mark missing stakeholder information as "Not provided"`;

export const BRD_TEMPLATE = `# Business Requirements Document

## 1. Overview

### Business Use Case
{%Summarize the overarching business use case in 1-2 paragraphs%}

### Business Value
{%Describe the specific value this delivers to the client and what decisions they will make with this data%}

### Stakeholders

| Role | Name | Email | Notes |
|------|------|-------|-------|
| Primary Business Stakeholder | {name or "Not provided"} | {email or "Not provided"} | {notes} |
| Technical Contact - {Data Source 1} | {name or "Not provided"} | {email or "Not provided"} | {notes} |
| QA/UAT - {Data Source 1} | {name or "Not provided"} | {email or "Not provided"} | {notes} |
| Technical Contact - {Data Source 2} | {name or "Not provided"} | {email or "Not provided"} | {notes} |
| QA/UAT - {Data Source 2} | {name or "Not provided"} | {email or "Not provided"} | {notes} |

## 2. Deliverable Summary

### {Deliverable Name 1}
- {bullet point of required output}
- {bullet point of required output}

**Acceptance Criteria:**
- {specific measurable requirement}
- {specific measurable requirement}

### {Deliverable Name 2}
- {bullet point of required output}
- {bullet point of required output}

**Acceptance Criteria:**
- {specific measurable requirement}
- {specific measurable requirement}

## 3. Global Business Rules, Notes, Known Issues

### Business Rules
- {global rule that governs data interpretation}
- {global rule that governs data interpretation}

### Filters
- **{Data Source 1}**: {key filters for this source}
- **{Data Source 2}**: {key filters for this source}

### Time Periods
- **{Data Source 1}**: {relevant time periods}
- **{Data Source 2}**: {relevant time periods}

### Granularity
- **{Data Source 1}**: {granularity level description}
- **{Data Source 2}**: {granularity level description}

### Data Quality
{%Note any data quality considerations%}

### Known Issues/Constraints
- {documented limitation or challenge}
- {documented limitation or challenge}

## 4. Output Definitions

### {Data Source/Output Name}

**Summary Table:**

| Column Name | Description | Data Source |
|-------------|-------------|-------------|
| {field_name} | {clear description} | {specific source system} |
| {field_name} | {clear description} | {specific source system} |

**Detailed Field Definitions:**

#### {Field Name 1}
- **Description**: {Clear explanation of what the field represents}
- **Data Sources**: {Specific source systems, never "multiple sources"}
- **Calculation**: {Formula or logic if calculated, omit if not}
- **Example Values**: {Only if explicitly mentioned in sources}
- **Business Rules**: {Any rules governing this field}
- **Exceptions/Edge Cases**: {Only if explicitly mentioned}
- **Data Clean-up Rules**: {Only if explicitly mentioned}

#### {Field Name 2}
- **Description**: {Clear explanation of what the field represents}
- **Data Sources**: {Specific source systems}
- **Calculation**: {If applicable}
- **Business Rules**: {Any rules governing this field}

## 5. Future Phases / Enhancements

*The following items are explicitly confirmed to be out of scope for this body of work but may be actioned as future phases or enhancements:*

### Phase 2 Considerations
- {item explicitly noted as future phase}
- {item explicitly noted as out of scope}

### Potential Enhancements
- {enhancement explicitly discussed but deferred}
- {capability mentioned as future consideration}`;

/**
 * Punchlist prompt for Business Requirements Documents
 * Defines what needs to be discovered and tracked for BRD completion
 */
export const BRD_PUNCHLIST_PROMPT = `You are tracking the discovery progress for a Business Requirements Document.

## WHAT THIS DOCUMENT NEEDS TO DISCOVER

A complete BRD requires clarity on:

**Technical Feasibility**
- Can each requirement be implemented with available systems?
- Are there technical blockers or limitations?
- What are the performance implications?

**User Acceptance Criteria**
- What specific measurable criteria define success for each feature?
- How will users validate the implementation?
- What edge cases need to be handled?

**Data Sources & Integration**
- Which specific source systems provide which data?
- What are the technical contact points for each system?
- Are there data quality or availability concerns?
- What are the integration dependencies?

**Business Rules & Logic**
- What calculations or transformations are required?
- What filters, time periods, and granularity apply?
- Are there conflicting business rules that need reconciliation?

**Stakeholder Alignment**
- Are all stakeholders identified with contact information?
- Is there alignment on deliverables and priorities?
- Are there competing or contradictory requirements?

**Constraints & Limitations**
- What are the known technical or business constraints?
- What future enhancements are explicitly out of scope?
- What data quality issues need to be addressed?

## TRACK THESE CATEGORIES

- 🚨 **Risks**: Technical feasibility concerns, performance issues, integration challenges, data quality risks
- ❓ **Unknowns**: Missing acceptance criteria, undefined data sources, unclear business rules, unconfirmed stakeholders
- 🚧 **Blockers**: Unavailable systems, unresponsive stakeholders, missing access or permissions, prerequisite work
- ⚡ **Gaps**: Missing requirements, undefined calculations, incomplete field definitions, missing stakeholder roles
- ⚠️ **Contradictions**: Conflicting requirements from different stakeholders, inconsistent business rules, incompatible priorities

## FORWARD-THINKING DIRECTION

This punchlist sets the agenda for discovery conversations. Each item should:
1. **Guide what to ask next**: "What specific questions need answers?"
2. **Document what was found**: "How did this knowledge resolve or modify the item?"
3. **Track remaining uncertainty**: "What still needs to be discovered?"

When new knowledge arrives, analyze:
- Does it fully resolve an existing item? → Mark RESOLVED
- Does it partially address or clarify an item? → Mark MODIFIED
- Does it reveal new risks, unknowns, or gaps? → Add as NEW
- Does it contradict previous information? → Flag as CONTRADICTION

## FOCUS

What do we still need to learn to make this BRD complete, accurate, and implementable?`;
