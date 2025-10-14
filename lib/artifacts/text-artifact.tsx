/**
 * Generic text artifact for rendering markdown documents
 * Used by both 'text' and 'knowledge' artifact kinds
 */

import { Artifact } from '@/components/create-artifact';
import { Editor } from '@/components/text-editor';

export const textArtifact = new Artifact({
  kind: 'text',
  description: 'Editable text/markdown document',
  content: Editor,
  actions: [],
  toolbar: [],
  onStreamPart: () => {
    // No-op: text artifacts don't need stream part handling
  },
});
