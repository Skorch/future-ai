import { formatDistance } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { getLogger } from '@/lib/logger';
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useDebounceCallback, useWindowSize } from 'usehooks-ts';
import type { Document, Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import { MultimodalInput } from './multimodal-input';
import { Toolbar } from './toolbar';
import { VersionFooter } from './version-footer';
import { ArtifactActions } from './artifact-actions';
import { ArtifactCloseButton } from './artifact-close-button';
import { ArtifactMessages } from './artifact-messages';
import { useSidebar } from './ui/sidebar';
import { useArtifact } from '@/hooks/use-artifact';
import equal from 'fast-deep-equal';
import { createDocumentCacheMutator } from '@/lib/cache/document-cache';

const logger = getLogger('Artifact');
import type { UseChatHelpers } from '@ai-sdk/react';
import type { VisibilityType } from './visibility-selector';
import type { Attachment, ChatMessage } from '@/lib/types';
import {
  artifactRegistry,
  type ArtifactKind,
} from '@/lib/artifacts/artifact-registry';

// Export artifact definitions for compatibility
export const artifactDefinitions = artifactRegistry
  .getAllConfigs()
  .map((config) => config.component);
export type { ArtifactKind };

export interface UIArtifact {
  title: string;
  documentId: string;
  versionId?: string; // Specific version ID for this chat (optional for backward compat)
  kind: ArtifactKind;
  content: string;
  isVisible: boolean;
  status: 'streaming' | 'idle';
  boundingBox: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

function PureArtifact({
  chatId,
  workspaceId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  sendMessage,
  messages,
  setMessages,
  regenerate,
  votes,
  isReadonly,
  selectedVisibilityType,
}: {
  chatId: string;
  workspaceId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>['status'];
  stop: UseChatHelpers<ChatMessage>['stop'];
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
  votes: Array<Vote> | undefined;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
  regenerate: UseChatHelpers<ChatMessage>['regenerate'];
  isReadonly: boolean;
  selectedVisibilityType: VisibilityType;
}) {
  const { artifact, setArtifact, metadata, setMetadata } = useArtifact();

  // Debug logging for artifact state
  logger.debug('Current artifact state:', {
    documentId: artifact.documentId,
    status: artifact.status,
    hasContent: !!artifact.content,
    contentLength: artifact.content?.length || 0,
    title: artifact.title,
    kind: artifact.kind,
  });

  const shouldFetchDocument =
    artifact.documentId !== 'init' && artifact.status !== 'streaming';
  const fetchUrl = useMemo(() => {
    if (!shouldFetchDocument || !workspaceId) return null;

    const baseUrl = artifactRegistry.getGetUrl(
      artifact.kind,
      workspaceId,
      artifact.documentId,
    );

    // If versionId is present, append it as query param to fetch specific version
    if (artifact.versionId && baseUrl) {
      return `${baseUrl}?versionId=${artifact.versionId}`;
    }

    return baseUrl;
  }, [
    shouldFetchDocument,
    workspaceId,
    artifact.kind,
    artifact.documentId,
    artifact.versionId,
  ]);

  logger.debug('Document fetch conditions:', {
    shouldFetchDocument,
    fetchUrl,
    documentId: artifact.documentId,
    status: artifact.status,
  });

  const {
    data: documents,
    isLoading: isDocumentsFetching,
    mutate: mutateDocuments,
  } = useSWR<Array<Document>>(fetchUrl, fetcher);

  const [mode, setMode] = useState<'edit' | 'diff'>('edit');
  const [document, setDocument] = useState<Document | null>(null);
  const [currentVersionIndex, setCurrentVersionIndex] = useState(-1);

  const { open: isSidebarOpen } = useSidebar();

  useEffect(() => {
    logger.debug(' Documents loaded:', {
      documentsCount: documents?.length || 0,
      isLoading: isDocumentsFetching,
      hasDocuments: !!documents,
    });

    if (documents && documents.length > 0) {
      const mostRecentDocument = documents.at(-1);

      logger.debug(' Most recent document:', {
        hasContent: !!(mostRecentDocument as { content?: string })?.content,
        contentLength:
          (mostRecentDocument as { content?: string })?.content?.length || 0,
        documentId: mostRecentDocument?.id,
        title: mostRecentDocument?.title,
      });

      if (mostRecentDocument) {
        setDocument(mostRecentDocument);
        setCurrentVersionIndex(documents.length - 1);

        logger.debug(' Updating artifact with document content');
        setArtifact((currentArtifact) => ({
          ...currentArtifact,
          content: (mostRecentDocument as { content?: string })?.content ?? '',
        }));
      }
    } else {
      logger.debug(' No documents loaded or empty documents array');
    }
  }, [documents, setArtifact, isDocumentsFetching]);

  useEffect(() => {
    mutateDocuments();
  }, [artifact.status, mutateDocuments]);

  const [isContentDirty, setIsContentDirty] = useState(false);

  // Centralized cache mutator
  const { mutate: globalMutate } = useSWRConfig();
  const cacheMutator = useMemo(() => {
    if (!workspaceId || artifact.documentId === 'init') {
      return null;
    }
    return createDocumentCacheMutator(
      globalMutate,
      workspaceId,
      artifact.documentId,
    );
  }, [globalMutate, workspaceId, artifact.documentId]);

  const handleContentChange = useCallback(
    async (updatedContent: string) => {
      if (!artifact || !workspaceId || !cacheMutator) {
        logger.debug(
          'Cannot save: missing artifact, workspaceId, or cache mutator',
        );
        setIsContentDirty(false);
        return;
      }

      logger.debug('Starting auto-save for document:', artifact.documentId);

      try {
        // Get current document for comparison
        const currentDocument = documents?.at(-1);

        if (!currentDocument) {
          logger.debug('No current document found, skipping save');
          setIsContentDirty(false);
          return;
        }

        if (
          (currentDocument as { content?: string })?.content === updatedContent
        ) {
          logger.debug('Content unchanged, skipping save');
          setIsContentDirty(false);
          return;
        }

        logger.debug('Content changed, saving...');

        // Get save URL from registry
        const saveUrl = artifactRegistry.getSaveUrl(
          artifact.kind,
          workspaceId,
          artifact.documentId,
        );

        if (!saveUrl) {
          logger.error(
            'No save route configured for artifact kind:',
            artifact.kind,
          );
          setIsContentDirty(false);
          return;
        }

        const method = 'PATCH';
        const body: Record<string, unknown> = {
          content: updatedContent,
          versionId: artifact.versionId, // Send specific version ID to update
        };

        logger.debug('Saving to:', saveUrl, {
          versionId: artifact.versionId,
        });

        const response = await fetch(saveUrl, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          throw new Error(`Save failed: ${response.statusText}`);
        }

        const result = await response.json();
        logger.debug('Save result:', result);

        // Refresh ALL caches (SWR client-side caches)
        await cacheMutator.invalidateAll();

        logger.debug('All caches refreshed after save');
      } catch (error) {
        logger.error('Auto-save failed:', error);
      } finally {
        // Always clear dirty state after save attempt
        setIsContentDirty(false);
      }
    },
    [artifact, workspaceId, documents, cacheMutator],
  );

  const debouncedHandleContentChange = useDebounceCallback(
    handleContentChange,
    2000,
  );

  const saveContent = useCallback(
    (updatedContent: string, debounce: boolean) => {
      logger.debug('saveContent called', {
        hasDocument: !!document,
        contentLength: updatedContent?.length,
        currentContentLength: (document as { content?: string })?.content
          ?.length,
        debounce,
      });

      if (
        document &&
        updatedContent !== (document as { content?: string })?.content
      ) {
        logger.debug('Content differs, triggering save');
        setIsContentDirty(true);

        if (debounce) {
          debouncedHandleContentChange(updatedContent);
        } else {
          handleContentChange(updatedContent);
        }
      } else {
        logger.debug('Content unchanged or no document, skipping save');
      }
    },
    [document, debouncedHandleContentChange, handleContentChange],
  );

  function getDocumentContentById(index: number) {
    if (!documents) return '';
    if (!documents[index]) return '';
    return (documents[index] as { content?: string })?.content ?? '';
  }

  const handleVersionChange = (type: 'next' | 'prev' | 'toggle' | 'latest') => {
    if (!documents) return;

    if (type === 'latest') {
      setCurrentVersionIndex(documents.length - 1);
      setMode('edit');
    }

    if (type === 'toggle') {
      setMode((mode) => (mode === 'edit' ? 'diff' : 'edit'));
    }

    if (type === 'prev') {
      if (currentVersionIndex > 0) {
        setCurrentVersionIndex((index) => index - 1);
      }
    } else if (type === 'next') {
      if (currentVersionIndex < documents.length - 1) {
        setCurrentVersionIndex((index) => index + 1);
      }
    }
  };

  const [isToolbarVisible, setIsToolbarVisible] = useState(false);

  /*
   * NOTE: if there are no documents, or if
   * the documents are being fetched, then
   * we mark it as the current version.
   */

  const isCurrentVersion =
    documents && documents.length > 0
      ? currentVersionIndex === documents.length - 1
      : true;

  const { width: windowWidth, height: windowHeight } = useWindowSize();
  const isMobile = windowWidth ? windowWidth < 768 : false;

  const artifactComponent = artifactRegistry.getComponent(artifact.kind);

  if (!artifactComponent) {
    throw new Error(`Artifact component not found for kind: ${artifact.kind}`);
  }

  useEffect(() => {
    if (artifact.documentId !== 'init') {
      if (artifactComponent.initialize) {
        artifactComponent.initialize({
          documentId: artifact.documentId,
          setMetadata,
        });
      }
    }
  }, [artifact.documentId, artifactComponent, setMetadata]);

  // Save on page close/navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Cancel debounced save and save immediately if dirty
      if (isContentDirty && artifact.content) {
        debouncedHandleContentChange.cancel();
        handleContentChange(artifact.content);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [
    isContentDirty,
    artifact.content,
    debouncedHandleContentChange,
    handleContentChange,
  ]);

  return (
    <AnimatePresence>
      {artifact.isVisible && (
        <motion.div
          data-testid="artifact"
          className="flex flex-row h-dvh w-dvw fixed top-0 left-0 z-50 bg-transparent"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { delay: 0.4 } }}
        >
          {!isMobile && (
            <motion.div
              className="fixed bg-background h-dvh"
              initial={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
              animate={{ width: windowWidth, right: 0 }}
              exit={{
                width: isSidebarOpen ? windowWidth - 256 : windowWidth,
                right: 0,
              }}
            />
          )}

          {!isMobile && (
            <motion.div
              className="relative w-[400px] bg-muted dark:bg-background h-dvh shrink-0"
              initial={{ opacity: 0, x: 10, scale: 1 }}
              animate={{
                opacity: 1,
                x: 0,
                scale: 1,
                transition: {
                  delay: 0.1,
                  type: 'spring',
                  stiffness: 300,
                  damping: 30,
                },
              }}
              exit={{
                opacity: 0,
                x: 0,
                scale: 1,
                transition: { duration: 0 },
              }}
            >
              <AnimatePresence>
                {!isCurrentVersion && (
                  <motion.div
                    className="left-0 absolute h-dvh w-[400px] top-0 bg-zinc-900/50 z-50"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  />
                )}
              </AnimatePresence>

              <div className="flex flex-col h-full justify-between items-center">
                <ArtifactMessages
                  chatId={chatId}
                  workspaceId={workspaceId}
                  status={status}
                  votes={votes}
                  messages={messages}
                  setMessages={setMessages}
                  regenerate={regenerate}
                  isReadonly={isReadonly}
                  artifactStatus={artifact.status}
                />

                <div className="flex flex-row gap-2 relative items-end w-full px-4 pb-4">
                  <MultimodalInput
                    chatId={chatId}
                    workspaceId={workspaceId}
                    input={input}
                    setInput={setInput}
                    status={status}
                    stop={stop}
                    attachments={attachments}
                    setAttachments={setAttachments}
                    messages={messages}
                    sendMessage={sendMessage}
                    className="bg-background dark:bg-muted"
                    setMessages={setMessages}
                    selectedVisibilityType={selectedVisibilityType}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <motion.div
            className="fixed dark:bg-muted bg-background h-dvh flex flex-col overflow-y-scroll md:border-l dark:border-zinc-700 border-zinc-200"
            initial={
              isMobile
                ? {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
                : {
                    opacity: 1,
                    x: artifact.boundingBox.left,
                    y: artifact.boundingBox.top,
                    height: artifact.boundingBox.height,
                    width: artifact.boundingBox.width,
                    borderRadius: 50,
                  }
            }
            animate={
              isMobile
                ? {
                    opacity: 1,
                    x: 0,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth ? windowWidth : 'calc(100dvw)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 300,
                      damping: 30,
                      duration: 0.8,
                    },
                  }
                : {
                    opacity: 1,
                    x: 400,
                    y: 0,
                    height: windowHeight,
                    width: windowWidth
                      ? windowWidth - 400
                      : 'calc(100dvw-400px)',
                    borderRadius: 0,
                    transition: {
                      delay: 0,
                      type: 'spring',
                      stiffness: 300,
                      damping: 30,
                      duration: 0.8,
                    },
                  }
            }
            exit={{
              opacity: 0,
              scale: 0.5,
              transition: {
                delay: 0.1,
                type: 'spring',
                stiffness: 600,
                damping: 30,
              },
            }}
          >
            <div className="p-2 flex flex-row justify-between items-start">
              <div className="flex flex-row gap-4 items-start">
                <ArtifactCloseButton />

                <div className="flex flex-col">
                  <div className="font-medium">{artifact.title}</div>

                  {isContentDirty ? (
                    <div className="text-sm text-muted-foreground">
                      Saving changes...
                    </div>
                  ) : document ? (
                    <div className="text-sm text-muted-foreground">
                      {`Updated ${formatDistance(
                        new Date(document.createdAt),
                        new Date(),
                        {
                          addSuffix: true,
                        },
                      )}`}
                    </div>
                  ) : (
                    <div className="w-32 h-3 mt-2 bg-muted-foreground/20 rounded-md animate-pulse" />
                  )}
                </div>
              </div>

              <ArtifactActions
                artifact={artifact}
                currentVersionIndex={currentVersionIndex}
                handleVersionChange={handleVersionChange}
                isCurrentVersion={isCurrentVersion}
                mode={mode}
                metadata={metadata}
                setMetadata={setMetadata}
              />
            </div>

            <div className="dark:bg-muted bg-background h-full overflow-y-scroll !max-w-full items-center">
              <artifactComponent.content
                title={artifact.title}
                content={
                  isCurrentVersion
                    ? artifact.content
                    : getDocumentContentById(currentVersionIndex)
                }
                mode={mode}
                status={artifact.status}
                currentVersionIndex={currentVersionIndex}
                onSaveContent={saveContent}
                isInline={false}
                isCurrentVersion={isCurrentVersion}
                getDocumentContentById={getDocumentContentById}
                isLoading={isDocumentsFetching && !artifact.content}
                metadata={metadata}
                setMetadata={setMetadata}
              />

              <AnimatePresence>
                {isCurrentVersion && (
                  <Toolbar
                    isToolbarVisible={isToolbarVisible}
                    setIsToolbarVisible={setIsToolbarVisible}
                    sendMessage={sendMessage}
                    status={status}
                    stop={stop}
                    setMessages={setMessages}
                    artifactKind={artifact.kind}
                    documentEnvelopeId={artifact.documentId}
                    workspaceId={workspaceId}
                    isReadonly={isReadonly}
                    mutateDocuments={mutateDocuments}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {!isCurrentVersion && (
                <VersionFooter
                  currentVersionIndex={currentVersionIndex}
                  documents={documents}
                  handleVersionChange={handleVersionChange}
                  workspaceId={workspaceId}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Artifact = memo(PureArtifact, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) return false;
  if (!equal(prevProps.votes, nextProps.votes)) return false;
  if (prevProps.input !== nextProps.input) return false;
  if (!equal(prevProps.messages, nextProps.messages.length)) return false;
  if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType)
    return false;

  return true;
});
