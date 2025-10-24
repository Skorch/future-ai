'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Copy, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react';

interface ActionsDropdownProps {
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
  onSetDefault?: () => void;
  showSetDefault?: boolean;
  deleteDisabled?: boolean;
  deleteTooltip?: string;
}

export function ActionsDropdown({
  onEdit,
  onClone,
  onDelete,
  onSetDefault,
  showSetDefault = false,
  deleteDisabled = false,
  deleteTooltip,
}: ActionsDropdownProps) {
  const deleteMenuItem = (
    <DropdownMenuItem
      onClick={deleteDisabled ? undefined : onDelete}
      disabled={deleteDisabled}
      className="text-destructive focus:text-destructive"
    >
      <Trash2 />
      Delete
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="size-8 p-0">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Open actions menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onClone}>
          <Copy />
          Clone
        </DropdownMenuItem>
        {showSetDefault && onSetDefault && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSetDefault} className="font-medium">
              <Star />
              Set as Default
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        {deleteDisabled && deleteTooltip ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>{deleteMenuItem}</TooltipTrigger>
              <TooltipContent>
                <p>{deleteTooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          deleteMenuItem
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
