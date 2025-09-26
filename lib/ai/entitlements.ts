import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

// All authenticated users get the same entitlements now
export const userEntitlements: Entitlements = {
  maxMessagesPerDay: 100,
  availableChatModelIds: [
    'claude-sonnet-4',
    'claude-sonnet-4-thinking',
    'claude-opus-4-1',
    'claude-opus-4-1-thinking',
  ],
};

// For backward compatibility, export a function that returns entitlements
export function getEntitlements(): Entitlements {
  return userEntitlements;
}
