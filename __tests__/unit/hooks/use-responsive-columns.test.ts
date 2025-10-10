import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useResponsiveColumns } from '@/hooks/use-responsive-columns';
import type { Column } from 'react-data-grid';

// Mock usehooks-ts
vi.mock('usehooks-ts', () => ({
  useWindowSize: vi.fn(),
}));

// Import after mocking
import { useWindowSize } from 'usehooks-ts';

describe('useResponsiveColumns Hook', () => {
  const mockColumns: Column<{ id: string; name: string; email: string }>[] = [
    { key: 'id', name: 'ID' },
    { key: 'name', name: 'Name' },
    { key: 'email', name: 'Email' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Desktop Viewport (>= 1024px)', () => {
    it('should return all columns for desktop width', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 1920, height: 1080 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toEqual(mockColumns);
      expect(result.current).toHaveLength(3);
    });

    it('should return all columns at exactly 1024px', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 1024, height: 768 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toEqual(mockColumns);
    });

    it('should return all columns for very large displays', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 3840, height: 2160 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toEqual(mockColumns);
    });
  });

  describe('Tablet Viewport (640px - 1023px)', () => {
    it('should filter columns based on tablet config', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 768, height: 1024 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toHaveLength(2);
      expect(result.current).toEqual([
        { key: 'id', name: 'ID' },
        { key: 'name', name: 'Name' },
      ]);
    });

    it('should work at exactly 640px (tablet breakpoint)', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 640, height: 800 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toHaveLength(2);
      expect(result.current.map((c) => c.key)).toEqual(['id', 'name']);
    });

    it('should work at 1023px (just below desktop)', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 1023, height: 768 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toHaveLength(2);
    });
  });

  describe('Mobile Viewport (< 640px)', () => {
    it('should filter columns based on mobile config', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 375, height: 667 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toHaveLength(1);
      expect(result.current).toEqual([{ key: 'id', name: 'ID' }]);
    });

    it('should work at very small mobile width', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 320, height: 568 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toHaveLength(1);
      expect(result.current[0].key).toBe('id');
    });

    it('should work at 639px (just below tablet)', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 639, height: 800 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle width of 0 (default from useWindowSize)', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 0, height: 0 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      // Width 0 < 640, should use mobile config
      expect(result.current).toHaveLength(1);
      expect(result.current[0].key).toBe('id');
    });

    it('should handle undefined width (fallback to 0)', () => {
      vi.mocked(useWindowSize).mockReturnValue({
        width: undefined,
        height: undefined,
      } as never);

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      // Undefined width defaults to 0, which is < 640 (mobile)
      expect(result.current).toHaveLength(1);
    });

    it('should handle empty mobile config', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 375, height: 667 });

      const config = {
        mobile: [],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toEqual([]);
    });

    it('should handle config with no matching columns', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 768, height: 1024 });

      const config = {
        mobile: ['nonexistent'],
        tablet: ['also-nonexistent'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      expect(result.current).toEqual([]);
    });

    it('should handle empty columns array', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 1920, height: 1080 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result } = renderHook(() => useResponsiveColumns([], config));

      expect(result.current).toEqual([]);
    });

    it('should maintain column order from config', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 768, height: 1024 });

      // Tablet config has reversed order
      const config = {
        mobile: ['id'],
        tablet: ['email', 'id'], // Note: email before id
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      // Should maintain order from allColumns, not config
      // Filter preserves original array order
      expect(result.current.map((c) => c.key)).toEqual(['id', 'email']);
    });
  });

  describe('Memoization', () => {
    it('should memoize results when width does not change', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 1920, height: 1080 });

      const config = {
        mobile: ['id'],
        tablet: ['id', 'name'],
      };

      const { result, rerender } = renderHook(() =>
        useResponsiveColumns(mockColumns, config),
      );

      const firstResult = result.current;
      rerender();
      const secondResult = result.current;

      // Same reference = memoized
      expect(firstResult).toBe(secondResult);
    });

    it('should recalculate when width changes', () => {
      const { result, rerender } = renderHook(
        ({ width }) => {
          vi.mocked(useWindowSize).mockReturnValue({ width, height: 1080 });
          return useResponsiveColumns(mockColumns, {
            mobile: ['id'],
            tablet: ['id', 'name'],
          });
        },
        { initialProps: { width: 1920 } },
      );

      const desktopResult = result.current;
      expect(desktopResult).toHaveLength(3);

      rerender({ width: 768 });
      const tabletResult = result.current;
      expect(tabletResult).toHaveLength(2);

      // Different results
      expect(desktopResult).not.toBe(tabletResult);
    });

    it('should recalculate when config changes', () => {
      vi.mocked(useWindowSize).mockReturnValue({ width: 768, height: 1024 });

      const { result, rerender } = renderHook(
        ({ config }) => useResponsiveColumns(mockColumns, config),
        {
          initialProps: {
            config: { mobile: ['id'], tablet: ['id', 'name'] },
          },
        },
      );

      const firstResult = result.current;
      expect(firstResult).toHaveLength(2);

      rerender({
        config: { mobile: ['id'], tablet: ['id', 'name', 'email'] },
      });
      const secondResult = result.current;
      expect(secondResult).toHaveLength(3);

      expect(firstResult).not.toBe(secondResult);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle objective table columns correctly', () => {
      const objectiveColumns: Column<{
        id: string;
        title: string;
        status: string;
        publishedAt: string;
        actions: string;
      }>[] = [
        { key: 'title', name: 'Title' },
        { key: 'status', name: 'Status' },
        { key: 'publishedAt', name: 'Published' },
        { key: 'actions', name: 'Actions' },
      ];

      vi.mocked(useWindowSize).mockReturnValue({ width: 375, height: 667 });

      const config = {
        mobile: ['title', 'actions'],
        tablet: ['title', 'status', 'actions'],
      };

      const { result } = renderHook(() =>
        useResponsiveColumns(objectiveColumns, config),
      );

      expect(result.current).toHaveLength(2);
      expect(result.current.map((c) => c.key)).toEqual(['title', 'actions']);
    });

    it('should handle responsive resize from mobile to desktop', () => {
      const { result, rerender } = renderHook(
        ({ width }) => {
          vi.mocked(useWindowSize).mockReturnValue({ width, height: 800 });
          return useResponsiveColumns(mockColumns, {
            mobile: ['id'],
            tablet: ['id', 'name'],
          });
        },
        { initialProps: { width: 375 } },
      );

      // Mobile
      expect(result.current).toHaveLength(1);

      // Tablet
      rerender({ width: 768 });
      expect(result.current).toHaveLength(2);

      // Desktop
      rerender({ width: 1920 });
      expect(result.current).toHaveLength(3);
    });
  });
});
