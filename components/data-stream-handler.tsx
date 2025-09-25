'use client';

import { useEffect, useRef } from 'react';
import { artifactDefinitions } from './artifact';
import { initialArtifactData, useArtifact } from '@/hooks/use-artifact';
import { useDataStream } from './data-stream-provider';

export function DataStreamHandler() {
  const { dataStream } = useDataStream();

  const { artifact, setArtifact, setMetadata } = useArtifact();
  const lastProcessedIndex = useRef(-1);

  useEffect(() => {
    if (!dataStream?.length) return;

    const newDeltas = dataStream.slice(lastProcessedIndex.current + 1);
    lastProcessedIndex.current = dataStream.length - 1;

    newDeltas.forEach((delta) => {
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
          console.log(
            '[DataStreamHandler] Creating new artifact from initial data',
          );
          return { ...initialArtifactData, status: 'streaming' };
        }

        console.log('[DataStreamHandler] Processing delta:', {
          type: delta.type,
          hasData: !!delta.data,
          dataPreview:
            typeof delta.data === 'string'
              ? delta.data.substring(0, 50)
              : delta.data,
        });

        switch (delta.type) {
          case 'data-id':
            console.log('[DataStreamHandler] Setting document ID:', delta.data);
            return {
              ...draftArtifact,
              documentId: delta.data,
              status: 'streaming',
            };

          case 'data-title':
            console.log('[DataStreamHandler] Setting title:', delta.data);
            return {
              ...draftArtifact,
              title: delta.data,
              status: 'streaming',
            };

          case 'data-kind':
            console.log('[DataStreamHandler] Setting kind:', delta.data);
            return {
              ...draftArtifact,
              kind: delta.data,
              status: 'streaming',
            };

          case 'data-clear':
            console.log(
              '[DataStreamHandler] CLEARING CONTENT - status set to streaming',
            );
            return {
              ...draftArtifact,
              content: '',
              status: 'streaming',
            };

          case 'data-finish':
            console.log('[DataStreamHandler] FINISHING - status set to idle');
            return {
              ...draftArtifact,
              status: 'idle',
            };

          case 'data-modeChanged':
            // Mode changes are handled by ModeIndicator component
            console.log(
              '[DataStreamHandler] Mode changed event (handled elsewhere)',
            );
            return draftArtifact;

          default:
            console.log(
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
