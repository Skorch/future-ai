import 'server-only';

import type { CategoryHandler, GenerationContext } from './types';
import type { ArtifactType } from '@/lib/db/schema';
import { ObjectiveDocumentBuilder } from '@/lib/ai/prompts/builders';
import {
  processStream,
  buildStreamConfig,
  fetchSourceDocuments,
} from '@/lib/artifacts/document-types/base-handler';
import { db } from '@/lib/db/queries';
import { workspace } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { getObjectiveById } from '@/lib/db/objective';
import { getCurrentVersionGoal } from '@/lib/db/objective-document';
import { myProvider } from '@/lib/ai/providers';

export class ObjectiveHandler implements CategoryHandler {
  readonly category = 'objective' as const;

  async generate(
    artifactType: ArtifactType,
    context: GenerationContext,
  ): Promise<string> {
    // Fetch workspace
    const [ws] = await db
      .select()
      .from(workspace)
      .where(
        and(
          eq(workspace.id, context.workspaceId),
          eq(workspace.userId, context.session.user.id),
          isNull(workspace.deletedAt),
        ),
      )
      .limit(1);

    // Fetch objective if objectiveId exists
    const objective = context.objectiveId
      ? await getObjectiveById(context.objectiveId, context.session.user.id)
      : null;

    // Fetch objective goal if objective exists
    let objectiveGoal: string | null = null;
    if (objective) {
      const goalData = await getCurrentVersionGoal(
        objective.id,
        context.session.user.id,
      );
      objectiveGoal = goalData?.goal ?? null;
    }

    // Load source documents if provided
    const sourceContent = context.sourceDocumentIds
      ? await fetchSourceDocuments(
          context.sourceDocumentIds,
          context.workspaceId,
        )
      : '';

    // Instantiate builder
    const builder = new ObjectiveDocumentBuilder();

    // Generate system prompt
    const systemPrompt = builder.generate(
      artifactType,
      ws || null,
      objective,
      objectiveGoal,
    );

    // Build user prompt with context
    const userPrompt = this.buildPromptWithContext(
      context.instruction,
      context.currentVersion,
      sourceContent,
    );

    // Create stream config
    const streamConfig = buildStreamConfig({
      model: myProvider.languageModel('artifact-model'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: 4000,
      temperature: 0.4,
    });

    // Process stream and return content
    if (!context.dataStream) {
      throw new Error('dataStream is required for artifact generation');
    }

    return processStream(streamConfig, context.dataStream);
  }

  private buildPromptWithContext(
    instruction?: string,
    currentVersion?: string,
    sourceContent?: string,
  ): string {
    // Start with instruction or default
    let prompt = instruction || 'Generate the document';

    // Add source content if provided
    if (sourceContent) {
      prompt += `\n\n## Source Materials\n${sourceContent}`;
    }

    // Add current version if exists
    if (currentVersion) {
      prompt += `\n\n## Current Version\n\`\`\`\n${currentVersion}\n\`\`\`\n\nUpdate based on instruction above.`;
    }

    return prompt;
  }
}
