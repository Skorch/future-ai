'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AddButton,
  KnowledgeInput,
  KnowledgeUploadButton,
  SummarizeButton,
} from './primitives';

interface ObjectiveKnowledgeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ObjectiveKnowledgeModal({
  open,
  onOpenChange,
}: ObjectiveKnowledgeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-screen-toast-mobile">
        <DialogHeader>
          <DialogTitle>Add Knowledge to Objective</DialogTitle>
          <DialogDescription>
            Upload a file or paste content below. We&apos;ll automatically
            analyze and classify it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <KnowledgeUploadButton />

          <div className="grid gap-2">
            <Label htmlFor="content">Content</Label>
            <KnowledgeInput />
          </div>
        </div>

        <DialogFooter>
          <AddButton />
          <SummarizeButton />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/*
 * FUTURE EXTENSIONS:
 *
 * Now that KnowledgeProvider is lifted to parent, you can add sibling components
 * that share the same knowledge creation state:
 *
 * // Sidebar quick-add (no modal UI, shares provider state)
 * export function SidebarKnowledgeQuickAdd() {
 *   return (
 *     <div className="space-y-2 p-4">
 *       <KnowledgeInput compact rows={3} />
 *       <AddButton size="sm" />
 *     </div>
 *   );
 * }
 *
 * // Usage in parent:
 * <KnowledgeProvider {...}>
 *   <ObjectiveKnowledgeModal open={...} onOpenChange={...} />
 *   <SidebarKnowledgeQuickAdd />  // Shares same state & actions
 * </KnowledgeProvider>
 *
 * // Draft indicator in header (reads context, doesn't modify)
 * export function KnowledgeDraftIndicator() {
 *   const { content, byteSize } = useKnowledge();
 *   if (!content) return null;
 *   return <Badge>Draft: {(byteSize / 1024).toFixed(1)}KB</Badge>;
 * }
 */
