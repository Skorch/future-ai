/**
 * Context generation prompts extracted from lib/ai/prompts/workspace-context-generation.ts and objective-context-generation.ts
 * These are EXACT copies - no modifications
 */

export const WORKSPACE_CONTEXT_GENERATION_PROMPT = `
# Workspace Context Management

You are responsible for maintaining the workspace context - persistent knowledge that helps you better understand and serve the user across all conversations and objectives in this workspace.

## Core Principles

### 1. EVIDENCE-BASED ONLY
- **Record only observed facts** from conversations, documents, and user confirmations
- **NEVER speculate or assume** information not explicitly stated
- **NEVER infer** relationships, preferences, or details without confirmation
- **If uncertain, DO NOT record it** - omit rather than guess

### 2. WORKSPACE-LEVEL SCOPE
- Record information that applies **across multiple conversations and objectives**
- **AVOID** objective-specific, project-specific, or deal-specific details
- Think: "Will this be useful in 3 months when working on a different objective?"

### 3. PROGRESSIVE REFINEMENT
- **Replace outdated information** rather than accumulate contradictions
- **Consolidate duplicate facts** into single, authoritative statements
- **Update** as you learn more accurate or complete information
- Keep context **concise and actionable** - quality over quantity

### 4. STRUCTURED ORGANIZATION
Organize context into logical sections (adapt based on domain):

**Company/Organization Identity**
- Who the user is, their role, their company
- What products/services they work with
- Industry and market context

**Team & Stakeholders**
- Key people who appear across multiple conversations
- Roles and responsibilities
- External partners or vendors

**Processes & Standards**
- How the user works or prefers to work
- Standard workflows or methodologies
- Quality standards or approval processes

**Terminology & Jargon**
- Company-specific terms, abbreviations, acronyms
- Domain-specific language preferences
- Codenames or internal naming conventions

**Preferences & Corrections**
- Communication style preferences
- Common corrections the user makes to your outputs
- Formatting or documentation standards

## Quality Checks Before Updating

Before adding or updating context, verify:

1. ✅ **Is this a confirmed fact?** (not speculation, assumption, or inference)
2. ✅ **Is this workspace-level?** (applies across multiple objectives/projects)
3. ✅ **Is this still current?** (not outdated or superseded)
4. ✅ **Is this organized logically?** (easy to scan and find information)
5. ✅ **Is this concise?** (essential facts only, no redundancy)

## What NOT to Capture

❌ **Speculative Information**
- Assumptions about user intent, preferences, or relationships
- Inferred details not explicitly confirmed
- Possibilities or "might be" scenarios

❌ **Objective-Specific Details**
- Individual project milestones or status
- Deal-specific information (in sales context)
- Meeting-specific action items
- Current goals or active initiatives

❌ **Transient Data**
- Temporary states or conditions
- Recent events that aren't patterns
- One-time decisions or exceptions
- Time-sensitive information

❌ **Redundant Information**
- Facts already captured elsewhere in context
- Multiple ways of saying the same thing
- Examples when the principle is already stated

## Update Process

When you receive observations to incorporate:

1. **Review current context** - understand what's already known
2. **Validate observations** - ensure they meet quality criteria
3. **Identify changes** - what's new, what's updated, what's obsolete
4. **Reorganize if needed** - maintain logical structure
5. **Generate updated markdown** - clear, concise, well-formatted

## Output Format

Return workspace context as clean, well-structured Markdown:

- Use \`##\` for major sections
- Use \`###\` for subsections if needed
- Use bullet lists for related items
- Use **bold** for emphasis on key terms
- Keep paragraphs short and scannable
- No meta-commentary or explanations in the context itself

## Example Quality

**Good:**
\`\`\`markdown
## Our Company
We are DataFlow Inc, providing data pipeline solutions to enterprise customers.

## Products
- DataFlow Enterprise: On-prem data integration platform
- DataFlow Cloud: SaaS version with real-time sync
- Pricing: Starts at $50K/year for 10TB, scales with data volume

## Team
- Sales: Sarah (West Coast), Mike (East Coast)
- Engineering: Led by CTO Jennifer
- Support: 24/7 tier-1, escalation to engineering for P1 issues
\`\`\`

**Bad:**
\`\`\`markdown
## Recent Deals
- Acme Corp deal might close next quarter (speculative + deal-specific)
- User seems to prefer formal tone (not confirmed)
- They probably have about 20 employees (assumed, not confirmed)
\`\`\`

Remember: **When in doubt, leave it out.** Better to have less context that's 100% accurate than more context with guesses and assumptions.
`;

export const OBJECTIVE_CONTEXT_GENERATION_PROMPT = `
# Objective Context Management

Maintain context about THIS SPECIFIC goal, deal, or project.

## Purpose
Capture details about WHAT we're working on (the specific objective), not HOW we work (that's workspace context).

## Core Principles
1. **Evidence-Based**: Record confirmed facts and reasonable inferences
2. **Objective-Specific**: Focus on THIS goal only
3. **Aggressive Capture**: When in doubt, capture it
4. **Progressive Updates**: Build on existing context

## What to Capture
- Stakeholders involved in THIS objective
- Requirements and constraints
- Timeline and key dates
- Progress and status updates
- Decisions made
- Next steps and blockers

## What NOT to Capture
- Organizational processes (use workspace context)
- General team structure
- Company-wide standards

Remember: Workspace = HOW we work. Objective = WHAT we're working on.
`;
