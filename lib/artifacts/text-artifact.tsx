/**
 * Generic text artifact for rendering markdown documents
 * Used by both 'text' and 'knowledge' artifact kinds
 */

import { Artifact } from '@/components/create-artifact';
import { DiffView } from '@/components/diffview';
import { DocumentSkeleton } from '@/components/document-skeleton';
import { Editor } from '@/components/text-editor';
import { ClockRewind, CopyIcon } from '@/components/icons';
import { toast } from 'sonner';

type TextArtifactMetadata = {};

export const textArtifact = new Artifact<'text', TextArtifactMetadata>({
  kind: 'text',
  description: 'Editable text/markdown document',

  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'data-textDelta') {
      setArtifact((draftArtifact) => {
        return {
          ...draftArtifact,
          content: draftArtifact.content + streamPart.data,
          // Keep current visibility state (auto-expand removed)
          isVisible: draftArtifact.isVisible,
          status: 'streaming',
        };
      });
    }
  },

  content: ({
    mode,
    status,
    content,
    isCurrentVersion,
    currentVersionIndex,
    onSaveContent,
    getDocumentContentById,
    isLoading,
    metadata,
  }) => {
    // Show skeleton while fetching document from server
    if (isLoading) {
      return <DocumentSkeleton artifactKind="text" />;
    }

    // Diff mode: compare current version against previous version
    if (mode === 'diff') {
      // Get the previous version (if it exists)
      const previousContent =
        currentVersionIndex > 0
          ? getDocumentContentById(currentVersionIndex - 1)
          : '';

      // Current version content is passed via the content prop
      const currentContent = content;

      return (
        <DiffView oldContent={previousContent} newContent={currentContent} />
      );
    }

    // Edit mode: show editor with proper padding
    return (
      <div className="flex flex-row py-8 md:p-20 px-4">
        <Editor
          content={content}
          isCurrentVersion={isCurrentVersion}
          currentVersionIndex={currentVersionIndex}
          status={status}
          onSaveContent={onSaveContent}
        />
      </div>
    );
  },

  actions: [
    {
      icon: <ClockRewind size={18} />,
      description: 'View changes',
      onClick: ({ handleVersionChange }) => {
        handleVersionChange('toggle');
      },
      isDisabled: ({ currentVersionIndex }) => {
        // Can't view changes for the first version (no previous version to compare)
        return currentVersionIndex === 0;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy to clipboard',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard!');
      },
    },
  ],

  toolbar: [],
});
