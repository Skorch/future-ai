import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withAuth, type ActionResult } from '@/lib/with-auth';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock Next.js redirect
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

// Mock logger to avoid console output during tests
vi.mock('@/lib/logger', () => ({
  getLogger: vi.fn(() => ({
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('withAuth Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should pass userId to wrapped function when authenticated', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<
        [string, string],
        Promise<ActionResult<{ result: string }>>
      >(async (userId: string, arg: string) => ({
        success: true,
        data: { result: `${userId}-${arg}` },
      }));

      const wrappedFn = withAuth('testAction', mockFn);
      const result = await wrappedFn('test-arg');

      expect(auth).toHaveBeenCalled();
      expect(mockFn).toHaveBeenCalledWith('user-123', 'test-arg');
      expect(result).toEqual({
        success: true,
        data: { result: 'user-123-test-arg' },
      });
    });

    it('should redirect to /login when userId is null', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: null } as never);

      const mockFn = vi.fn<[string, string], Promise<ActionResult>>();
      const wrappedFn = withAuth('testAction', mockFn);

      await expect(wrappedFn('test-arg')).rejects.toThrow('NEXT_REDIRECT');
      expect(redirect).toHaveBeenCalledWith('/login');
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should redirect to /login when userId is undefined', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: undefined } as never);

      const mockFn = vi.fn<[string, string], Promise<ActionResult>>();
      const wrappedFn = withAuth('testAction', mockFn);

      await expect(wrappedFn('test-arg')).rejects.toThrow('NEXT_REDIRECT');
      expect(redirect).toHaveBeenCalledWith('/login');
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should redirect to /login when auth returns null session', async () => {
      vi.mocked(auth).mockResolvedValue(null as never);

      const mockFn = vi.fn<[string, string], Promise<ActionResult>>();
      const wrappedFn = withAuth('testAction', mockFn);

      await expect(wrappedFn('test-arg')).rejects.toThrow('NEXT_REDIRECT');
      expect(redirect).toHaveBeenCalledWith('/login');
      expect(mockFn).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should catch and return ActionResult with error message when wrapped function throws Error', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<[string], Promise<ActionResult>>(async () => {
        throw new Error('Database connection failed');
      });

      const wrappedFn = withAuth('testAction', mockFn);
      const result = await wrappedFn();

      expect(result).toEqual({
        success: false,
        error: 'Database connection failed',
      });
    });

    it('should catch and return generic error message when wrapped function throws non-Error', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<[string], Promise<ActionResult>>(async () => {
        // eslint-disable-next-line no-throw-literal
        throw 'string error';
      });

      const wrappedFn = withAuth('testAction', mockFn);
      const result = await wrappedFn();

      expect(result).toEqual({
        success: false,
        error: 'Operation failed',
      });
    });

    it('should preserve ActionResult from wrapped function on success', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<[string, string], Promise<ActionResult>>(
        async () => ({
          success: true,
          revalidate: {
            paths: ['/workspace/123'],
            swrKeys: ['/api/workspace/123/objectives'],
          },
        }),
      );

      const wrappedFn = withAuth('testAction', mockFn);
      const result = await wrappedFn('arg1');

      expect(result).toEqual({
        success: true,
        revalidate: {
          paths: ['/workspace/123'],
          swrKeys: ['/api/workspace/123/objectives'],
        },
      });
    });

    it('should preserve error from wrapped function that returns ActionResult with success: false', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<[string, string], Promise<ActionResult>>(
        async () => ({
          success: false,
          error: 'Objective not found',
        }),
      );

      const wrappedFn = withAuth('testAction', mockFn);
      const result = await wrappedFn('obj-123');

      expect(result).toEqual({
        success: false,
        error: 'Objective not found',
      });
    });
  });

  describe('Type Safety and Generics', () => {
    it('should preserve type information for data payload', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      interface CustomData {
        id: string;
        name: string;
      }

      const mockFn = vi.fn<[string, string], Promise<ActionResult<CustomData>>>(
        async (userId: string, name: string) => ({
          success: true,
          data: { id: userId, name },
        }),
      );

      const wrappedFn = withAuth<[string], CustomData>('testAction', mockFn);
      const result = await wrappedFn('test-name');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'user-123', name: 'test-name' });
    });

    it('should support void return type (no data)', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<[string, string], Promise<ActionResult>>(
        async () => ({
          success: true,
        }),
      );

      const wrappedFn = withAuth('testAction', mockFn);
      const result = await wrappedFn('arg1');

      expect(result).toEqual({ success: true });
      expect(result.data).toBeUndefined();
    });

    it('should handle multiple arguments correctly', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<
        [string, string, number, boolean],
        Promise<ActionResult>
      >(async (userId: string, arg1: string, arg2: number, arg3: boolean) => ({
        success: true,
        data: { userId, arg1, arg2, arg3 },
      }));

      const wrappedFn = withAuth<[string, number, boolean], unknown>(
        'testAction',
        mockFn,
      );
      const result = await wrappedFn('test', 42, true);

      expect(mockFn).toHaveBeenCalledWith('user-123', 'test', 42, true);
      expect(result.success).toBe(true);
    });

    it('should handle zero additional arguments (only userId)', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<[string], Promise<ActionResult>>(
        async (userId: string) => ({
          success: true,
          data: { userId },
        }),
      );

      const wrappedFn = withAuth<[], unknown>('testAction', mockFn);
      const result = await wrappedFn();

      expect(mockFn).toHaveBeenCalledWith('user-123');
      expect(result.success).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle auth throwing an error', async () => {
      vi.mocked(auth).mockRejectedValue(new Error('Auth service unavailable'));

      const mockFn = vi.fn<[string], Promise<ActionResult>>();
      const wrappedFn = withAuth('testAction', mockFn);
      const result = await wrappedFn();

      expect(result).toEqual({
        success: false,
        error: 'Auth service unavailable',
      });
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should handle async function that resolves immediately', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<[string], Promise<ActionResult>>(async () => ({
        success: true,
      }));

      const wrappedFn = withAuth('testAction', mockFn);
      const result = await wrappedFn();

      expect(result.success).toBe(true);
      expect(mockFn).toHaveBeenCalledWith('user-123');
    });

    it('should preserve revalidate paths and SWR keys', async () => {
      vi.mocked(auth).mockResolvedValue({ userId: 'user-123' } as never);

      const mockFn = vi.fn<[string, string], Promise<ActionResult>>(
        async () => ({
          success: true,
          revalidate: {
            paths: ['/workspace/ws-1', '/workspace/ws-1/objective/obj-1'],
            swrKeys: ['/api/workspace/ws-1/objectives'],
          },
        }),
      );

      const wrappedFn = withAuth('testAction', mockFn);
      const result = await wrappedFn('ws-1');

      expect(result.revalidate).toEqual({
        paths: ['/workspace/ws-1', '/workspace/ws-1/objective/obj-1'],
        swrKeys: ['/api/workspace/ws-1/objectives'],
      });
    });
  });
});
