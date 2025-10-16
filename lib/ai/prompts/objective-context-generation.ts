import { z } from 'zod';

/**
 * System prompt for objective context generation
 * Focuses on capturing specific goal/deal/project details
 */
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

/**
 * Generic schema for objective context
 * Domain guidance determines what goes in each field
 */
export const ObjectiveContextSchema = z.object({
  overview: z.string().optional().describe('Brief summary of the objective'),

  stakeholders: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .optional()
    .describe('People involved in this objective'),

  keyFacts: z
    .array(z.string())
    .optional()
    .describe('Important facts and context'),

  timeline: z
    .array(
      z.object({
        date: z.string(),
        event: z.string(),
      }),
    )
    .optional()
    .describe('Important dates and milestones'),

  requirements: z
    .array(z.string())
    .optional()
    .describe('Requirements and constraints'),

  progress: z
    .object({
      status: z.string().optional(),
      recentUpdates: z.array(z.string()).optional(),
      blockers: z.array(z.string()).optional(),
    })
    .optional()
    .describe('Current status and progress'),

  nextSteps: z.array(z.string()).optional().describe('Next actions to take'),

  notes: z.string().optional().describe('Additional notes and observations'),
});

export type ObjectiveContext = z.infer<typeof ObjectiveContextSchema>;

/**
 * Convert structured objective context to markdown
 */
export function formatObjectiveContextAsMarkdown(
  context: ObjectiveContext,
): string {
  const sections: string[] = [];

  if (context.overview) {
    sections.push(`## Overview\n\n${context.overview}`);
  }

  if (context.stakeholders && context.stakeholders.length > 0) {
    const lines: string[] = ['## Stakeholders'];
    context.stakeholders.forEach((s) => {
      lines.push(`\n### ${s.name}`);
      if (s.role) lines.push(`**Role:** ${s.role}`);
      if (s.notes) lines.push(s.notes);
    });
    sections.push(lines.join('\n'));
  }

  if (context.keyFacts && context.keyFacts.length > 0) {
    sections.push(
      `## Key Facts\n\n${context.keyFacts.map((f) => `- ${f}`).join('\n')}`,
    );
  }

  if (context.requirements && context.requirements.length > 0) {
    sections.push(
      `## Requirements\n\n${context.requirements.map((r) => `- ${r}`).join('\n')}`,
    );
  }

  if (context.timeline && context.timeline.length > 0) {
    const lines: string[] = ['## Timeline'];
    context.timeline.forEach((t) => {
      lines.push(`- **${t.date}**: ${t.event}`);
    });
    sections.push(lines.join('\n'));
  }

  if (context.progress) {
    const lines: string[] = ['## Progress'];
    if (context.progress.status) {
      lines.push(`**Status:** ${context.progress.status}`);
    }
    if (context.progress.recentUpdates?.length) {
      lines.push('\n**Recent Updates:**');
      context.progress.recentUpdates.forEach((u) => lines.push(`- ${u}`));
    }
    if (context.progress.blockers?.length) {
      lines.push('\n**Blockers:**');
      context.progress.blockers.forEach((b) => lines.push(`- ${b}`));
    }
    sections.push(lines.join('\n'));
  }

  if (context.nextSteps && context.nextSteps.length > 0) {
    sections.push(
      `## Next Steps\n\n${context.nextSteps.map((n) => `- ${n}`).join('\n')}`,
    );
  }

  if (context.notes) {
    sections.push(`## Notes\n\n${context.notes}`);
  }

  return sections.join('\n\n');
}
