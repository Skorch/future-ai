import { useMemo } from 'react';

const HEADER_HEIGHT = 35;
const ROW_HEIGHT = 53;
const MIN_HEIGHT = 400;
const MAX_HEIGHT = 600;

/**
 * Hook to calculate dynamic table height based on row count
 * @param rowCount - Number of rows in the table
 * @returns Calculated height as a CSS string
 */
export function useTableHeight(rowCount: number): string {
  return useMemo(() => {
    // Calculate height: header + (rows * row height)
    const calculatedHeight = HEADER_HEIGHT + rowCount * ROW_HEIGHT;

    // Apply min/max bounds
    const boundedHeight = Math.min(
      Math.max(calculatedHeight, MIN_HEIGHT),
      MAX_HEIGHT,
    );

    return `${boundedHeight}px`;
  }, [rowCount]);
}
