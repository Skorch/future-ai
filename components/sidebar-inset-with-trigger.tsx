'use client';

import {
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import type { ReactNode } from 'react';

/**
 * Wraps SidebarInset and adds a floating trigger button when sidebar is collapsed.
 * This ensures users can always open the sidebar, even when it's closed on desktop.
 */
export function SidebarInsetWithTrigger({ children }: { children: ReactNode }) {
  const { open, isMobile } = useSidebar();

  return (
    <SidebarInset>
      {/* Show floating trigger when sidebar is closed on desktop */}
      {!open && !isMobile && (
        <div className="fixed top-4 left-4 z-50">
          <SidebarTrigger />
        </div>
      )}
      {children}
    </SidebarInset>
  );
}
