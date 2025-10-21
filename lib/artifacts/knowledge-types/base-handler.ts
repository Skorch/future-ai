/**
 * Base utilities for knowledge handlers
 * Handles knowledge summary generation with topic filtering
 */

import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '@/lib/types';
import {
  processStream,
  buildStreamConfig,
} from '../document-types/base-handler';
import { ThinkingBudget } from '@/lib/artifacts/types';

/**
 * Knowledge handler interface
 * Note: Handlers receive props without summaryPrompt and supply their own
 */
export interface KnowledgeHandler {
  kind: 'knowledge';
  metadata: {
    type: string;
    name: string;
    description: string;
  };
  onGenerateKnowledge(
    props: Omit<GenerateKnowledgeProps, 'summaryPrompt'>,
  ): Promise<string>;
}

/**
 * Props for knowledge generation
 */
export interface GenerateKnowledgeProps {
  rawContent: string;
  objectiveTitle: string;
  objectiveDescription?: string;
  instruction: string;
  summaryPrompt: string;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  domain: import('@/lib/db/schema').DomainWithRelations;
  workspace: import('@/lib/db/schema').Workspace | null;
  objective: import('@/lib/db/schema').Objective | null;
  objectiveGoal?: string | null;
  artifactType: import('@/lib/db/schema').ArtifactType;
}

/**
 * Generate knowledge summary with topic filtering
 * Reuses base-handler utilities for streaming
 */
export async function generateKnowledgeSummary({
  rawContent,
  objectiveTitle,
  objectiveDescription,
  summaryPrompt,
  instruction,
  dataStream,
}: GenerateKnowledgeProps): Promise<string> {
  const { myProvider } = await import('@/lib/ai/providers');

  // Build topic filtering context
  const objectiveContext = objectiveDescription
    ? `${objectiveTitle}: ${objectiveDescription}`
    : objectiveTitle;

  // Compose system prompt with topic filtering
  const systemPrompt = `You are processing raw knowledge (transcript, email, notes, etc.) for a specific objective.

# Current Objective
${objectiveContext}

# Topic Filtering Instructions
1. **Identify all topics** discussed in the raw content
2. **Filter for relevance**: Only include topics directly related to the objective above
3. **Exclude off-topic content**:
   - Discussions about different products or projects
   - Other objectives or initiatives
   - Personal or social conversations
   - Administrative matters unrelated to this objective

# Your Task
${summaryPrompt}

# Additional Instructions
${instruction}

IMPORTANT:
- At the end of your summary, include a brief note about what topics were filtered out (1-2 sentences)
- Focus on actionable information relevant to the objective
- Maintain the factual content from the source material`;

  const userPrompt = `Please analyze and summarize the following content, filtering for topics relevant to "${objectiveTitle}":

---
${rawContent}
---`;

  // Use existing stream utilities from base-handler
  const config = buildStreamConfig({
    model: myProvider.languageModel('claude-sonnet-4'),
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4, // Lower for consistent summaries
    maxOutputTokens: 4096,
    thinkingBudget: ThinkingBudget.MEDIUM, // 8000 tokens for knowledge analysis
  });

  const content = await processStream(config, dataStream);

  return content;
}
