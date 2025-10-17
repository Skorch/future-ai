import { z } from 'zod';

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
