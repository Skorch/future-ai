import type { ChatMode } from '@/lib/db/schema';
import type { ModeConfig } from './types';
import { discoveryMode } from './discovery';
import { buildMode } from './build';

// Simple registry for the two modes
export const MODES: Record<ChatMode, ModeConfig> = {
  discovery: discoveryMode,
  build: buildMode,
};

export function getModeConfig(mode: ChatMode): ModeConfig {
  return MODES[mode] || MODES.discovery; // Default to discovery if undefined
}

// Re-export types for convenience
export type { ModeConfig } from './types';
