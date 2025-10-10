import { useMemo } from 'react';
import { useWindowSize } from 'usehooks-ts';
import type { Column } from 'react-data-grid';

export interface ResponsiveColumnConfig {
  mobile: string[];
  tablet: string[];
}

/**
 * Hook to filter columns based on viewport width for responsive tables
 * @param allColumns - All available columns
 * @param config - Configuration for which columns to show at each breakpoint
 * @returns Filtered columns based on current viewport width
 */
export function useResponsiveColumns<T>(
  allColumns: Column<T>[],
  config: ResponsiveColumnConfig,
): Column<T>[] {
  const { width = 0 } = useWindowSize();

  return useMemo(() => {
    // Mobile breakpoint: < 640px
    if (width < 640) {
      return allColumns.filter((col) =>
        config.mobile.includes(col.key as string),
      );
    }

    // Tablet breakpoint: 640px - 1023px
    if (width < 1024) {
      return allColumns.filter((col) =>
        config.tablet.includes(col.key as string),
      );
    }

    // Desktop: show all columns
    return allColumns;
  }, [width, allColumns, config]);
}
