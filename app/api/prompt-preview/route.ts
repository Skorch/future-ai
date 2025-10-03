import { type NextRequest, NextResponse } from 'next/server';
import {
  assembleMainAgentPrompt,
  assembleDocumentPrompt,
} from '@/lib/ai/prompts/assemblers';
import type { DomainId } from '@/lib/domains';
import type { ChatMode, ModeContext } from '@/lib/db/schema';
import type { DocumentType } from '@/lib/artifacts';
import { getLogger } from '@/lib/logger';

const logger = getLogger('prompt-preview');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.type === 'agent') {
      // Assemble main agent prompt
      const result = await assembleMainAgentPrompt({
        domainId: body.domain as DomainId,
        mode: body.mode as ChatMode,
        modeContext: body.modeContext as ModeContext,
        isComplete: body.isComplete || false,
      });

      return NextResponse.json(result);
    }

    if (body.type === 'doc') {
      // Assemble document generation prompt
      const result = await assembleDocumentPrompt({
        documentType: body.documentType as DocumentType,
        agentInstruction: body.agentInstruction,
        metadata: body.metadata || {},
      });

      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Invalid type. Must be "agent" or "doc"' },
      { status: 400 },
    );
  } catch (error) {
    logger.error('Failed to generate prompt preview', error);
    return NextResponse.json(
      { error: 'Failed to generate prompt preview' },
      { status: 500 },
    );
  }
}
