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
