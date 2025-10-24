'use client';

import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DefaultDomainBadgeProps {
  isDefault: boolean;
}

export function DefaultDomainBadge({ isDefault }: DefaultDomainBadgeProps) {
  if (!isDefault) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="secondary" className="text-xs gap-1 cursor-help">
            <Star className="size-3 fill-current" />
            Default
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Default domain for new workspaces</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
