'use client';

import * as React from 'react';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

// Context to share tab width
const TabWidthContext = React.createContext<string>('9rem');

interface NavigationTabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsList> {
  tabWidth?: string; // CSS value like "9rem", "10rem"
}

export const NavigationTabsList = React.forwardRef<
  React.ElementRef<typeof TabsList>,
  NavigationTabsListProps
>(({ children, className, tabWidth = '10rem', ...props }, ref) => {
  return (
    <TabWidthContext.Provider value={tabWidth}>
      <TabsList
        ref={ref}
        className={cn(
          'h-auto w-full justify-start gap-2 bg-transparent',
          'flex overflow-x-auto',
          className,
        )}
        {...props}
      >
        {children}
      </TabsList>
    </TabWidthContext.Provider>
  );
});
NavigationTabsList.displayName = 'NavigationTabsList';

interface NavigationTabTriggerProps
  extends Omit<React.ComponentPropsWithoutRef<typeof TabsTrigger>, 'children'> {
  icon?: LucideIcon;
  label: string;
  count?: number;
  iconSize?: string; // Tailwind size class (e.g., "size-4", "size-5")
}

export const NavigationTabTrigger = React.forwardRef<
  React.ElementRef<typeof TabsTrigger>,
  NavigationTabTriggerProps
>(
  (
    { icon: Icon, label, count, iconSize = 'size-5', className, ...props },
    ref,
  ) => {
    const tabWidth = React.useContext(TabWidthContext);
    const displayLabel = count !== undefined ? `${label} (${count})` : label;

    return (
      <TabsTrigger
        ref={ref}
        className={cn(
          'flex flex-col items-center gap-2 py-3',
          'data-[state=active]:bg-muted hover:bg-muted/50',
          'rounded-full transition-all',
          'flex-shrink-0', // Prevent shrinking
          className,
        )}
        style={{ width: tabWidth }} // Direct inline style
        title={displayLabel}
        {...props}
      >
        {Icon && <Icon className={iconSize} />}
        <span className="text-sm font-medium text-center leading-tight line-clamp-2 w-full px-2">
          {displayLabel}
        </span>
      </TabsTrigger>
    );
  },
);
NavigationTabTrigger.displayName = 'NavigationTabTrigger';
