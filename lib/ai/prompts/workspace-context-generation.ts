import { z } from 'zod';

/**
 * Base system prompt for workspace context generation
 * Used by API route when AI generates/updates workspace context
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
\\\`\\\`\\\`markdown
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
\\\`\\\`\\\`

**Bad:**
\\\`\\\`\\\`markdown
## Recent Deals
- Acme Corp deal might close next quarter (speculative + deal-specific)
- User seems to prefer formal tone (not confirmed)
- They probably have about 20 employees (assumed, not confirmed)
\\\`\\\`\\\`

Remember: **When in doubt, leave it out.** Better to have less context that's 100% accurate than more context with guesses and assumptions.
`;

/**
 * Zod schema for workspace context structure
 * Used by generateObject to ensure consistent output format
 */
export const WorkspaceContextSchema = z.object({
  companyIdentity: z
    .object({
      name: z.string().optional(),
      role: z.string().optional(),
      industry: z.string().optional(),
      products: z.array(z.string()).optional(),
      marketPosition: z.string().optional(),
    })
    .optional(),

  teamStakeholders: z
    .object({
      members: z
        .array(
          z.object({
            name: z.string(),
            role: z.string(),
          }),
        )
        .optional(),
      partners: z.array(z.string()).optional(),
      external: z.array(z.string()).optional(),
    })
    .optional(),

  processesStandards: z
    .object({
      workflows: z.array(z.string()).optional(),
      methodologies: z.array(z.string()).optional(),
      qualityStandards: z.array(z.string()).optional(),
      approvalProcesses: z.array(z.string()).optional(),
    })
    .optional(),

  terminology: z
    .object({
      abbreviations: z.record(z.string()).optional(),
      jargon: z.record(z.string()).optional(),
      codenames: z.record(z.string()).optional(),
    })
    .optional(),

  preferences: z
    .object({
      communicationStyle: z.string().optional(),
      documentationFormat: z.string().optional(),
      commonCorrections: z.array(z.string()).optional(),
    })
    .optional(),

  customSections: z.record(z.string()).optional(),
});

export type WorkspaceContext = z.infer<typeof WorkspaceContextSchema>;

/**
 * Convert structured workspace context to markdown
 */
export function formatWorkspaceContextAsMarkdown(
  context: WorkspaceContext,
): string {
  const sections: string[] = [];

  // Company Identity
  if (context.companyIdentity) {
    const { name, role, industry, products, marketPosition } =
      context.companyIdentity;
    const lines: string[] = ['## Company Identity'];

    if (name) lines.push(`**Company:** ${name}`);
    if (role) lines.push(`**User Role:** ${role}`);
    if (industry) lines.push(`**Industry:** ${industry}`);
    if (marketPosition) lines.push(`**Market Position:** ${marketPosition}`);

    if (products && products.length > 0) {
      lines.push('', '**Products/Services:**');
      products.forEach((p) => lines.push(`- ${p}`));
    }

    sections.push(lines.join('\n'));
  }

  // Team & Stakeholders
  if (context.teamStakeholders) {
    const { members, partners, external } = context.teamStakeholders;
    const lines: string[] = ['## Team & Stakeholders'];

    if (members && members.length > 0) {
      lines.push('', '**Team Members:**');
      members.forEach((m) => lines.push(`- **${m.name}**: ${m.role}`));
    }

    if (partners && partners.length > 0) {
      lines.push('', '**Partners:**');
      partners.forEach((p) => lines.push(`- ${p}`));
    }

    if (external && external.length > 0) {
      lines.push('', '**External Collaborators:**');
      external.forEach((e) => lines.push(`- ${e}`));
    }

    sections.push(lines.join('\n'));
  }

  // Processes & Standards
  if (context.processesStandards) {
    const { workflows, methodologies, qualityStandards, approvalProcesses } =
      context.processesStandards;
    const lines: string[] = ['## Processes & Standards'];

    if (workflows && workflows.length > 0) {
      lines.push('', '**Workflows:**');
      workflows.forEach((w) => lines.push(`- ${w}`));
    }

    if (methodologies && methodologies.length > 0) {
      lines.push('', '**Methodologies:**');
      methodologies.forEach((m) => lines.push(`- ${m}`));
    }

    if (qualityStandards && qualityStandards.length > 0) {
      lines.push('', '**Quality Standards:**');
      qualityStandards.forEach((q) => lines.push(`- ${q}`));
    }

    if (approvalProcesses && approvalProcesses.length > 0) {
      lines.push('', '**Approval Processes:**');
      approvalProcesses.forEach((a) => lines.push(`- ${a}`));
    }

    sections.push(lines.join('\n'));
  }

  // Terminology
  if (context.terminology) {
    const { abbreviations, jargon, codenames } = context.terminology;
    const lines: string[] = ['## Terminology'];

    if (abbreviations && Object.keys(abbreviations).length > 0) {
      lines.push('', '**Abbreviations:**');
      Object.entries(abbreviations).forEach(([key, value]) =>
        lines.push(`- **${key}**: ${value}`),
      );
    }

    if (jargon && Object.keys(jargon).length > 0) {
      lines.push('', '**Jargon:**');
      Object.entries(jargon).forEach(([key, value]) =>
        lines.push(`- **${key}**: ${value}`),
      );
    }

    if (codenames && Object.keys(codenames).length > 0) {
      lines.push('', '**Codenames:**');
      Object.entries(codenames).forEach(([key, value]) =>
        lines.push(`- **${key}**: ${value}`),
      );
    }

    sections.push(lines.join('\n'));
  }

  // Preferences
  if (context.preferences) {
    const { communicationStyle, documentationFormat, commonCorrections } =
      context.preferences;
    const lines: string[] = ['## Preferences'];

    if (communicationStyle)
      lines.push(`**Communication Style:** ${communicationStyle}`);
    if (documentationFormat)
      lines.push(`**Documentation Format:** ${documentationFormat}`);

    if (commonCorrections && commonCorrections.length > 0) {
      lines.push('', '**Common Corrections:**');
      commonCorrections.forEach((c) => lines.push(`- ${c}`));
    }

    sections.push(lines.join('\n'));
  }

  // Custom Sections
  if (context.customSections) {
    Object.entries(context.customSections).forEach(([title, content]) => {
      sections.push(`## ${title}\n\n${content}`);
    });
  }

  return sections.join('\n\n');
}
