import { tool } from 'ai';
import { z } from 'zod';
import {
  getPlaybooksForDomain,
  getPlaybookWithSteps,
} from '@/lib/db/queries/playbooks';
import type { PlaybookMetadata, PlaybookStep } from '@/lib/db/schema';
import { GET_PLAYBOOK_PROMPT } from '@/lib/ai/prompts/builders/shared/prompts/tools/get-playbook.prompts';
import { logger } from '@/lib/logger';

interface GetPlaybookProps {
  domainId: string; // Domain UUID
}

/**
 * Creates a dynamic getPlaybook tool based on available playbooks for the domain.
 * Returns null if no playbooks are available for the domain.
 */
export async function getPlaybook({ domainId }: GetPlaybookProps) {
  logger.debug(
    '[getPlaybook] Initializing getPlaybook tool for domain:',
    domainId,
  );
  // Fetch available playbooks for this domain
  const availablePlaybooks = await getPlaybooksForDomain(domainId);

  // If no playbooks available, don't register the tool
  if (availablePlaybooks.length === 0) {
    return null;
  }

  // Build dynamic enum from playbook names
  const playbookNames = availablePlaybooks.map((p: PlaybookMetadata) => p.name);

  // Build playbook descriptions for the parameter
  const playbookDescriptions = availablePlaybooks
    .map(
      (p: PlaybookMetadata) =>
        `- **${p.name}**: ${p.whenToUse || p.description || 'No description'}`,
    )
    .join('\n');

  // Build full tool description with available playbooks
  const fullDescription = `${GET_PLAYBOOK_PROMPT}\n\n## Available Playbooks for Current Domain\n\n${playbookDescriptions}`;

  // Create input schema with dynamic enum
  const inputSchema = z.object({
    playbookName: z
      .enum(playbookNames as [string, ...string[]])
      .describe(
        `The exact name of the playbook to retrieve.\n\nAvailable playbooks:\n${playbookDescriptions}`,
      ),
  });

  return tool({
    description: fullDescription,
    inputSchema,
    execute: async ({ playbookName }: { playbookName: string }) => {
      try {
        // Find playbook ID by name
        const metadata = availablePlaybooks.find(
          (p: PlaybookMetadata) => p.name === playbookName,
        );
        if (!metadata) {
          return {
            success: false,
            error: 'Playbook not found',
            message: `Could not find playbook "${playbookName}". This should not happen.`,
          };
        }

        // Fetch full playbook with steps
        const playbook = await getPlaybookWithSteps(metadata.id);
        if (!playbook) {
          return {
            success: false,
            error: 'Failed to load playbook',
            message: `Could not load playbook "${playbookName}". Please try again.`,
          };
        }

        // Format steps as markdown
        const formattedSteps = playbook.steps
          .sort((a: PlaybookStep, b: PlaybookStep) => a.sequence - b.sequence)
          .map(
            (step: PlaybookStep) =>
              `## Step ${step.sequence}:\n\n${step.instruction}`,
          )
          .join('\n\n');

        // Build complete playbook content
        const fullContent = `# ${playbook.name}

${playbook.description ? `## Description\n${playbook.description}\n\n` : ''}## When to Use This Playbook
${playbook.whenToUse}

## Steps to Execute

${formattedSteps}

## Success Criteria
This playbook is complete when all validation steps have been executed and user has confirmed the findings.`;

        return {
          success: true,
          playbook: {
            name: playbook.name,
            description: playbook.description,
            whenToUse: playbook.whenToUse,
            content: fullContent,
            stepCount: playbook.steps.length,
            steps: playbook.steps.map((step: PlaybookStep) => ({
              sequence: step.sequence,
              instruction: step.instruction,
            })),
          },
          message: `Retrieved playbook "${playbook.name}" with ${playbook.steps.length} steps.`,
        };
      } catch (error) {
        return {
          success: false,
          error: 'Unexpected error',
          message: `An error occurred while retrieving the playbook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  });
}
