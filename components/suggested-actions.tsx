'use client';

import { motion } from 'framer-motion';
import { memo } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';

// Simple suggestion button component for UI prompt suggestions
function Suggestion({
  suggestion,
  onClick,
  className,
  children,
}: {
  suggestion: string;
  onClick: (suggestion: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(suggestion)}
      className={`bg-muted text-foreground rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/80 cursor-pointer ${className || ''}`}
    >
      {children}
    </button>
  );
}

interface SuggestedActionsProps {
  chatId: string;
  workspaceId: string;
  sendMessage: UseChatHelpers<ChatMessage>['sendMessage'];
}

function PureSuggestedActions({
  chatId,
  workspaceId,
  sendMessage,
}: SuggestedActionsProps) {
  const suggestedActions = [
    'Explain to me your capabilities, available document types, and how to use this.',
    'What documents are available?',
  ];

  return (
    <div
      data-testid="suggested-actions"
      className="grid sm:grid-cols-2 gap-2 w-full"
    >
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={suggestedAction}
        >
          <Suggestion
            suggestion={suggestedAction}
            onClick={(suggestion) => {
              window.history.replaceState(
                {},
                '',
                `/workspace/${workspaceId}/chat/${chatId}`,
              );
              sendMessage({
                role: 'user',
                parts: [{ type: 'text', text: suggestion }],
              });
            }}
            className="text-left w-full h-auto whitespace-normal p-3"
          >
            {suggestedAction}
          </Suggestion>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) return false;

    return true;
  },
);
