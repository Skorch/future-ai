import type { UserType } from '@/app/(auth)/auth';
import type { ChatModel } from './models';

interface Entitlements {
  maxMessagesPerDay: number;
  availableChatModelIds: Array<ChatModel['id']>;
}

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 20,
    availableChatModelIds: ['claude-sonnet-4'],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 100,
    availableChatModelIds: [
      'claude-sonnet-4',
      'claude-sonnet-4-thinking',
      'claude-opus-4-1',
      'claude-opus-4-1-thinking',
    ],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
