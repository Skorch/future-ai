import { useState, type ReactNode } from 'react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandLoading,
} from '@/components/ui/command';
import { Zap, MessageSquare } from 'lucide-react';
import type { PlaybookMetadata } from '@/lib/db/schema';
import { usePlaybookSelector } from './use-playbook-selector';

// Export template for parent components to use
export const PLAYBOOK_MESSAGE_TEMPLATE = (name: string) =>
  `Use the getPlaybook tool to retrieve the "${name}" playbook and follow its steps.`;

interface PlaybookCommandPaletteProps {
  workspaceId: string;
  objectiveId?: string;
  onSelect: (playbook: PlaybookMetadata | null) => void;
  trigger: ReactNode;
  includeGeneralOption?: boolean;
  className?: string;
  disabled?: boolean;
}

export function PlaybookCommandPalette({
  workspaceId,
  objectiveId,
  onSelect,
  trigger,
  includeGeneralOption = false,
  className,
  disabled = false,
}: PlaybookCommandPaletteProps) {
  const { playbooks, loading } = usePlaybookSelector(workspaceId);
  const [open, setOpen] = useState(false);

  const handleSelect = (playbook: PlaybookMetadata | null) => {
    setOpen(false);
    onSelect(playbook);
  };

  const handleClick = () => {
    if (!disabled) {
      setOpen(true);
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        className={className}
        aria-disabled={disabled}
      >
        {trigger}
      </div>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search playbooks..." />
        <CommandList>
          {loading ? (
            <CommandLoading>Loading playbooks...</CommandLoading>
          ) : playbooks.length === 0 ? (
            <CommandEmpty>No playbooks available</CommandEmpty>
          ) : (
            <>
              {playbooks.map((p) => (
                <CommandItem key={p.id} onSelect={() => handleSelect(p)}>
                  <Zap className="mr-2 size-4" />
                  <div className="flex flex-col">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.whenToUse || p.description}
                    </span>
                  </div>
                </CommandItem>
              ))}
              {includeGeneralOption && (
                <CommandItem onSelect={() => handleSelect(null)}>
                  <MessageSquare className="mr-2 size-4" />
                  <div className="flex flex-col">
                    <span>General Questions</span>
                    <span className="text-xs text-muted-foreground">
                      Start without a playbook
                    </span>
                  </div>
                </CommandItem>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
