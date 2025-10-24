'use client';

import { getLogger } from '@/lib/logger';

const logger = getLogger('data-stream-handler');
import { useEffect, useRef, useState } from 'react';
import { artifactDefinitions } from './artifact';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { useDataStream } from './data-stream-provider';

export function DataStreamHandler() {
  const { dataStream } = useDataStream();

  // Track category from stream events (use state to trigger re-renders)
  const [category, setCategory] = useState<string | undefined>(undefined);

  // Use category-based artifact hook
  const { artifact, setArtifact, setMetadata } = useArtifact(category);
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    newDeltas.forEach((delta) => {
      // Extract category from data-category events
      if (delta.type === 'data-category') {
        const newCategory = delta.data as string;
        setCategory((prevCategory) => {
          if (prevCategory !== newCategory) {
            logger.debug('[DataStreamHandler] Category changed:', {
              from: prevCategory,
              to: newCategory,
            });
            return newCategory;
          }
          return prevCategory;
        });
      }

      const artifactDefinition = artifactDefinitions.find(
        (artifactDefinition) => artifactDefinition.kind === artifact.kind,
      );

      if (artifactDefinition?.onStreamPart) {
        artifactDefinition.onStreamPart({
          streamPart: delta,
          setArtifact,
          setMetadata,
        });
      }

      setArtifact((draftArtifact) => {
        if (!draftArtifact) {
          logger.debug(
            '[DataStreamHandler] Creating new artifact from initial data',
          );
          return { ...initialArtifactData, status: 'streaming' };
        }

        logger.debug('[DataStreamHandler] Processing delta:', {
          type: delta.type,
          hasData: !!delta.data,
          dataPreview:
            typeof delta.data === 'string'
              ? delta.data.substring(0, 50)
              : delta.data,
        });

        switch (delta.type) {
          case 'data-id':
            logger.debug(
              '[DataStreamHandler] Setting document ID:',
              delta.data,
            );
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: 'streaming',
            };

          case 'data-versionId':
            logger.debug('[DataStreamHandler] Setting version ID:', delta.data);
            return {
              ...draftArtifact,
              versionId: delta.data,
              status: 'streaming',
            };

          case 'data-title':
            logger.debug('[DataStreamHandler] Setting title:', delta.data);
            return {
              ...draftArtifact,
              title: delta.data,
              status: 'streaming',
            };

          case 'data-kind':
            logger.debug('[DataStreamHandler] Setting kind:', delta.data);
            return {
              ...draftArtifact,
              kind: delta.data,
              status: 'streaming',
            };

          case 'data-clear':
            logger.debug(
              '[DataStreamHandler] CLEARING CONTENT - status set to streaming',
            );
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          case 'data-finish':
            logger.debug('[DataStreamHandler] FINISHING - status set to idle');
            return {
              ...draftArtifact,
              status: 'idle',
            };

          case 'data-reasoning':
            // Log reasoning but don't accumulate in artifact content
            // Reasoning is for debugging/monitoring only - not persisted
            logger.debug('[DataStreamHandler] Reasoning delta received', {
              reasoningPreview: delta.data?.toString().slice(0, 100),
            });
            return draftArtifact;

          default:
            logger.debug(
              '[DataStreamHandler] Unhandled delta type:',
              delta.type,
            );
            return draftArtifact;
        }
      });
    });
  }, [dataStream, setArtifact, setMetadata, artifact]);

  return null;
}
