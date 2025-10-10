import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTableHeight } from '@/hooks/use-table-height';

describe('useTableHeight Hook', () => {
  // Constants from the hook
  const HEADER_HEIGHT = 35;
  const ROW_HEIGHT = 53;
  const MIN_HEIGHT = 400;
  const MAX_HEIGHT = 600;

  describe('Basic Calculations', () => {
    it('should calculate height for single row', () => {
      const { result } = renderHook(() => useTableHeight(1));
      const expected = HEADER_HEIGHT + 1 * ROW_HEIGHT; // 35 + 53 = 88

      // But MIN_HEIGHT is 400, so result should be 400px
      expect(result.current).toBe('400px');
    });

    it('should calculate height for multiple rows', () => {
      const { result } = renderHook(() => useTableHeight(5));
      const expected = HEADER_HEIGHT + 5 * ROW_HEIGHT; // 35 + 265 = 300

      // Still below MIN_HEIGHT (400)
      expect(result.current).toBe('400px');
    });

    it('should calculate height at exactly min threshold', () => {
      // MIN_HEIGHT = 400
      // 400 = HEADER_HEIGHT + (rows * ROW_HEIGHT)
      // 400 = 35 + (rows * 53)
      // 365 = rows * 53
      // rows = 6.88... (round up to 7 for MIN, but 6 is still under)
      const { result } = renderHook(() => useTableHeight(7));
      const calculated = HEADER_HEIGHT + 7 * ROW_HEIGHT; // 35 + 371 = 406

      expect(result.current).toBe('406px');
    });

    it('should calculate height for 10 rows', () => {
      const { result } = renderHook(() => useTableHeight(10));
      const expected = HEADER_HEIGHT + 10 * ROW_HEIGHT; // 35 + 530 = 565

      expect(result.current).toBe('565px');
    });
  });

  describe('Minimum Height Constraint (400px)', () => {
    it('should enforce minimum height for 0 rows', () => {
      const { result } = renderHook(() => useTableHeight(0));
      expect(result.current).toBe('400px');
    });

    it('should enforce minimum height for 1 row (88px calculated)', () => {
      const { result } = renderHook(() => useTableHeight(1));
      expect(result.current).toBe('400px');
    });

    it('should enforce minimum height for 3 rows (194px calculated)', () => {
      const { result } = renderHook(() => useTableHeight(3));
      expect(result.current).toBe('400px');
    });

    it('should enforce minimum height for 6 rows (353px calculated)', () => {
      const { result } = renderHook(() => useTableHeight(6));
      const calculated = HEADER_HEIGHT + 6 * ROW_HEIGHT; // 35 + 318 = 353
      expect(calculated).toBeLessThan(MIN_HEIGHT);
      expect(result.current).toBe('400px');
    });

    it('should not enforce minimum when calculated height exceeds it', () => {
      const { result } = renderHook(() => useTableHeight(8));
      const calculated = HEADER_HEIGHT + 8 * ROW_HEIGHT; // 35 + 424 = 459
      expect(calculated).toBeGreaterThan(MIN_HEIGHT);
      expect(result.current).toBe('459px');
    });
  });

  describe('Maximum Height Constraint (600px)', () => {
    it('should enforce maximum height for many rows', () => {
      const { result } = renderHook(() => useTableHeight(20));
      const calculated = HEADER_HEIGHT + 20 * ROW_HEIGHT; // 35 + 1060 = 1095
      expect(calculated).toBeGreaterThan(MAX_HEIGHT);
      expect(result.current).toBe('600px');
    });

    it('should enforce maximum height for 11 rows (618px calculated)', () => {
      const { result } = renderHook(() => useTableHeight(11));
      const calculated = HEADER_HEIGHT + 11 * ROW_HEIGHT; // 35 + 583 = 618
      expect(calculated).toBeGreaterThan(MAX_HEIGHT);
      expect(result.current).toBe('600px');
    });

    it('should allow 10 rows without hitting max (565px calculated)', () => {
      const { result } = renderHook(() => useTableHeight(10));
      const calculated = HEADER_HEIGHT + 10 * ROW_HEIGHT; // 35 + 530 = 565
      expect(calculated).toBeLessThan(MAX_HEIGHT);
      expect(result.current).toBe('565px');
    });

    it('should enforce maximum for 100 rows', () => {
      const { result } = renderHook(() => useTableHeight(100));
      expect(result.current).toBe('600px');
    });

    it('should enforce maximum for 1000 rows', () => {
      const { result } = renderHook(() => useTableHeight(1000));
      expect(result.current).toBe('600px');
    });
  });

  describe('Edge Cases', () => {
    it('should handle negative row count (treated as 0)', () => {
      const { result } = renderHook(() => useTableHeight(-5));
      const calculated = HEADER_HEIGHT + -5 * ROW_HEIGHT; // 35 - 265 = -230
      // Min is enforced
      expect(result.current).toBe('400px');
    });

    it('should handle very large row count', () => {
      const { result } = renderHook(() =>
        useTableHeight(Number.MAX_SAFE_INTEGER),
      );
      // Will definitely exceed MAX_HEIGHT
      expect(result.current).toBe('600px');
    });

    it('should handle decimal row count (edge case)', () => {
      // TypeScript would normally prevent this, but JavaScript allows it
      const { result } = renderHook(() => useTableHeight(5.7));
      const calculated = HEADER_HEIGHT + 5.7 * ROW_HEIGHT; // 35 + 302.1 = 337.1
      expect(result.current).toBe('400px'); // Below min
    });

    it('should handle floating point precision', () => {
      const { result } = renderHook(() => useTableHeight(10.999999));
      const calculated = HEADER_HEIGHT + 10.999999 * ROW_HEIGHT; // 35 + ~583 = ~618
      expect(result.current).toBe('600px'); // Should hit max
    });
  });

  describe('Boundary Testing', () => {
    it('should handle row count that results in exactly 400px', () => {
      // Need to reverse engineer: 400 = 35 + (rows * 53)
      // rows = 365 / 53 = 6.886... (not exact)
      // Let's test what happens at boundary
      const rows = Math.floor((MIN_HEIGHT - HEADER_HEIGHT) / ROW_HEIGHT); // 6
      const { result } = renderHook(() => useTableHeight(rows));
      expect(result.current).toBe('400px');
    });

    it('should handle row count that results in exactly 600px', () => {
      // 600 = 35 + (rows * 53)
      // rows = 565 / 53 = 10.66... (not exact)
      const rows = Math.floor((MAX_HEIGHT - HEADER_HEIGHT) / ROW_HEIGHT); // 10
      const { result } = renderHook(() => useTableHeight(rows));
      const calculated = HEADER_HEIGHT + rows * ROW_HEIGHT;
      expect(calculated).toBeLessThanOrEqual(MAX_HEIGHT);
      expect(result.current).toBe(`${calculated}px`);
    });

    it('should handle row count just above max threshold', () => {
      const rows = Math.ceil((MAX_HEIGHT - HEADER_HEIGHT) / ROW_HEIGHT) + 1; // 11 + 1 = 12
      const { result } = renderHook(() => useTableHeight(rows));
      expect(result.current).toBe('600px');
    });
  });

  describe('Memoization', () => {
    it('should memoize result for same row count', () => {
      const { result, rerender } = renderHook(() => useTableHeight(5));

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      expect(firstResult).toBe(secondResult);
      expect(firstResult).toBe('400px');
    });

    it('should recalculate when row count changes', () => {
      const { result, rerender } = renderHook(
        ({ count }) => useTableHeight(count),
        { initialProps: { count: 5 } },
      );

      const firstResult = result.current;
      expect(firstResult).toBe('400px');

      rerender({ count: 10 });
      const secondResult = result.current;
      expect(secondResult).toBe('565px');

      expect(firstResult).not.toBe(secondResult);
    });

    it('should handle rapid changes in row count', () => {
      const { result, rerender } = renderHook(
        ({ count }) => useTableHeight(count),
        { initialProps: { count: 1 } },
      );

      expect(result.current).toBe('400px');

      rerender({ count: 10 });
      expect(result.current).toBe('565px');

      rerender({ count: 20 });
      expect(result.current).toBe('600px');

      rerender({ count: 5 });
      expect(result.current).toBe('400px');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle empty objective list (0 rows)', () => {
      const { result } = renderHook(() => useTableHeight(0));
      expect(result.current).toBe('400px');
    });

    it('should handle typical objective list (5-10 items)', () => {
      const { result: result5 } = renderHook(() => useTableHeight(5));
      const { result: result10 } = renderHook(() => useTableHeight(10));

      expect(result5.current).toBe('400px'); // Below min
      expect(result10.current).toBe('565px'); // Above min, below max
    });

    it('should handle large objective list requiring scroll (15+ items)', () => {
      const { result } = renderHook(() => useTableHeight(15));
      expect(result.current).toBe('600px'); // Max enforced
    });

    it('should handle pagination (10 rows per page)', () => {
      const { result } = renderHook(() => useTableHeight(10));
      const calculated = HEADER_HEIGHT + 10 * ROW_HEIGHT; // 565px
      expect(result.current).toBe('565px');
      expect(calculated).toBeLessThan(MAX_HEIGHT);
    });

    it('should handle growing list (adding rows)', () => {
      const { result, rerender } = renderHook(
        ({ count }) => useTableHeight(count),
        { initialProps: { count: 3 } },
      );

      // Start with 3 rows
      expect(result.current).toBe('400px');

      // Add 2 more (5 total)
      rerender({ count: 5 });
      expect(result.current).toBe('400px');

      // Add 5 more (10 total)
      rerender({ count: 10 });
      expect(result.current).toBe('565px');

      // Add 5 more (15 total) - now at max
      rerender({ count: 15 });
      expect(result.current).toBe('600px');
    });
  });

  describe('Return Type', () => {
    it('should always return a string with px suffix', () => {
      const { result: result0 } = renderHook(() => useTableHeight(0));
      const { result: result5 } = renderHook(() => useTableHeight(5));
      const { result: result10 } = renderHook(() => useTableHeight(10));
      const { result: result20 } = renderHook(() => useTableHeight(20));

      expect(result0.current).toMatch(/^\d+px$/);
      expect(result5.current).toMatch(/^\d+px$/);
      expect(result10.current).toMatch(/^\d+px$/);
      expect(result20.current).toMatch(/^\d+px$/);
    });

    it('should return valid CSS height value', () => {
      const { result } = renderHook(() => useTableHeight(8));
      const heightValue = result.current;

      // Can be used directly in CSS
      const numericValue = Number.parseInt(heightValue);
      expect(Number.isNaN(numericValue)).toBe(false);
      expect(numericValue).toBeGreaterThan(0);
    });
  });
});
