'use client';

import { useState } from 'react';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { DOMAINS, type DomainId } from '@/lib/domains';
import { toast } from './toast';
import { useRouter } from 'next/navigation';

export function DomainSelector({
  initialDomain,
}: {
  initialDomain: DomainId;
}) {
  const router = useRouter();
  const [selectedDomain, setSelectedDomain] = useState<DomainId>(initialDomain);
  const [isLoading, setIsLoading] = useState(false);

  const handleDomainChange = async (domainId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainId }),
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedDomain(data.domainId);
        toast({
          type: 'success',
          description: `Switched to ${data.label} mode`,
        });

        // Refresh to update session claims (needed for JWT to refresh)
        router.refresh();
      } else {
        toast({
          type: 'error',
          description: 'Failed to update domain preference',
        });
      }
    } catch (error) {
      // Error already shown via toast above
      toast({
        type: 'error',
        description: 'Failed to update domain preference',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Agent Domain</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={selectedDomain}
        onValueChange={handleDomainChange}
      >
        {Object.values(DOMAINS).map((domain) => (
          <DropdownMenuRadioItem
            key={domain.id}
            value={domain.id}
            disabled={isLoading}
            className="cursor-pointer"
          >
            <div className="flex flex-col gap-0.5">
              <span>{domain.label}</span>
              <span className="text-xs text-muted-foreground">
                {domain.description}
              </span>
            </div>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}
