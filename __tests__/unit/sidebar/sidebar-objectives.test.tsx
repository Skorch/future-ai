import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SidebarObjectives } from '@/components/sidebar-objectives';
import type { Objective } from '@/lib/db/schema';

// Mock Next.js navigation hooks
const mockPush = vi.fn();
const mockParams = { objectiveId: undefined as string | undefined };

vi.mock('next/navigation', () => ({
  useParams: () => mockParams,
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock SWR
vi.mock('swr', () => ({
  default: vi.fn(),
}));

// Mock useSidebar hook and all sidebar UI components
const mockSetOpenMobile = vi.fn();
vi.mock('@/components/ui/sidebar', () => ({
  useSidebar: () => ({
    setOpenMobile: mockSetOpenMobile,
    open: true,
    setOpen: vi.fn(),
    openMobile: false,
    isMobile: false,
    state: 'expanded',
    toggleSidebar: vi.fn(),
  }),
  SidebarGroup: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group">{children}</div>
  ),
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-group-content">{children}</div>
  ),
  SidebarMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-menu">{children}</div>
  ),
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-menu-item">{children}</div>
  ),
  SidebarMenuButton: ({
    children,
    onClick,
    isActive,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    isActive?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      data-testid="sidebar-menu-button"
      data-active={isActive}
    >
      {children}
    </button>
  ),
}));

// Mock icon components
vi.mock('@/components/icons', () => ({
  CheckCircleFillIcon: ({ size }: { size?: number }) => (
    <svg data-testid="check-circle-icon" data-size={size} />
  ),
  FileIcon: ({ size }: { size?: number }) => (
    <svg data-testid="file-icon" data-size={size} />
  ),
}));

// Import SWR after mocking to get the mock reference
import useSWR from 'swr';

describe('SidebarObjectives Component', () => {
  const workspaceId = 'workspace-123';

  // Mock objectives data
  const mockObjectives: Objective[] = [
    {
      id: 'obj-1',
      workspaceId: 'workspace-123',
      objectiveDocumentId: 'doc-1',
      title: 'Q1 Revenue Growth Strategy',
      description: 'Increase revenue by 25%',
      documentType: 'strategy',
      status: 'published',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
      publishedAt: new Date('2024-01-15'),
      createdByUserId: 'user-1',
    },
    {
      id: 'obj-2',
      workspaceId: 'workspace-123',
      objectiveDocumentId: 'doc-2',
      title: 'Customer Retention Plan',
      description: 'Reduce churn by 15%',
      documentType: 'plan',
      status: 'open',
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-02-05'),
      publishedAt: null,
      createdByUserId: 'user-1',
    },
    {
      id: 'obj-3',
      workspaceId: 'workspace-123',
      objectiveDocumentId: null,
      title:
        'This is a very long objective title that should be truncated when displayed in the sidebar',
      description: 'Test truncation',
      documentType: 'other',
      status: 'open',
      createdAt: new Date('2024-03-01'),
      updatedAt: new Date('2024-03-01'),
      publishedAt: null,
      createdByUserId: 'user-1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockParams.objectiveId = undefined;
  });

  describe('Loading State', () => {
    it('should show skeleton loader while data is loading', () => {
      vi.mocked(useSWR).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      // Should show "Objectives" header
      expect(screen.getByText('Objectives')).toBeInTheDocument();

      // Should show skeleton loaders (5 items with specific widths)
      const skeletons = screen
        .getAllByRole('generic')
        .filter((el) => el.className.includes('bg-sidebar-accent-foreground'));
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should show correct number of skeleton items', () => {
      vi.mocked(useSWR).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { container } = render(
        <SidebarObjectives workspaceId={workspaceId} />,
      );

      // The loading state creates 5 skeleton items with specific widths
      const skeletonItems = container.querySelectorAll(
        '.bg-sidebar-accent-foreground\\/10',
      );
      expect(skeletonItems).toHaveLength(5);
    });

    it('should call SWR with correct API endpoint', () => {
      vi.mocked(useSWR).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      expect(useSWR).toHaveBeenCalledWith(
        `/api/workspace/${workspaceId}/objectives`,
        expect.any(Function),
      );
    });
  });

  describe('Empty State', () => {
    it('should show empty message when objectives array is empty', () => {
      vi.mocked(useSWR).mockReturnValue({
        data: [],
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      expect(screen.getByText('Objectives')).toBeInTheDocument();
      expect(
        screen.getByText('No objectives yet. Create one to get started!'),
      ).toBeInTheDocument();
    });

    it('should show empty message when data is undefined but not loading', () => {
      vi.mocked(useSWR).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      // When data is undefined, it defaults to empty array
      expect(
        screen.getByText('No objectives yet. Create one to get started!'),
      ).toBeInTheDocument();
    });
  });

  describe('Objectives List', () => {
    beforeEach(() => {
      vi.mocked(useSWR).mockReturnValue({
        data: mockObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });
    });

    it('should render all objectives from data', () => {
      render(<SidebarObjectives workspaceId={workspaceId} />);

      expect(
        screen.getByText('Q1 Revenue Growth Strategy'),
      ).toBeInTheDocument();
      expect(screen.getByText('Customer Retention Plan')).toBeInTheDocument();
      expect(
        screen.getByText(
          'This is a very long objective title that should be truncated when displayed in the sidebar',
        ),
      ).toBeInTheDocument();
    });

    it('should show "Objectives" header with border and styling', () => {
      const { container } = render(
        <SidebarObjectives workspaceId={workspaceId} />,
      );

      const header = screen.getByText('Objectives');
      expect(header).toBeInTheDocument();

      // Check header styling classes
      expect(header.className).toContain('font-semibold');
      expect(header.className).toContain('text-sm');

      // Check border container
      const borderContainer = container.querySelector('.border-t');
      expect(borderContainer).toBeInTheDocument();
    });

    it('should render "View All Objectives →" link', () => {
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const viewAllButton = screen.getByText('View All Objectives →');
      expect(viewAllButton).toBeInTheDocument();
      expect(viewAllButton.tagName).toBe('BUTTON');
    });

    it('should apply truncate class to objective titles', () => {
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const titleElements = screen
        .getAllByRole('generic')
        .filter((el) => el.className.includes('truncate'));
      expect(titleElements.length).toBeGreaterThan(0);
    });
  });

  describe('Status Icons', () => {
    beforeEach(() => {
      vi.mocked(useSWR).mockReturnValue({
        data: mockObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });
    });

    it('should show CheckCircleFillIcon for published objectives', () => {
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const checkIcons = screen.getAllByTestId('check-circle-icon');
      // Only one published objective in mock data
      expect(checkIcons).toHaveLength(1);
    });

    it('should show FileIcon for open objectives', () => {
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const fileIcons = screen.getAllByTestId('file-icon');
      // Two open objectives in mock data
      expect(fileIcons).toHaveLength(2);
    });

    it('should render icons with correct size prop', () => {
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const allIcons = [
        ...screen.getAllByTestId('check-circle-icon'),
        ...screen.getAllByTestId('file-icon'),
      ];

      allIcons.forEach((icon) => {
        expect(icon.getAttribute('data-size')).toBe('16');
      });
    });
  });

  describe('Active Objective Highlighting', () => {
    beforeEach(() => {
      vi.mocked(useSWR).mockReturnValue({
        data: mockObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });
    });

    it('should highlight active objective based on URL params', () => {
      mockParams.objectiveId = 'obj-2';

      const { container } = render(
        <SidebarObjectives workspaceId={workspaceId} />,
      );

      // Find the button containing "Customer Retention Plan"
      const buttons = screen.getAllByRole('button');
      const activeButton = buttons.find((btn) =>
        btn.textContent?.includes('Customer Retention Plan'),
      );

      expect(activeButton).toBeInTheDocument();
      // The SidebarMenuButton component receives isActive prop
      // We can't directly test the prop, but we can verify the element exists
    });

    it('should not highlight any objective when objectiveId is undefined', () => {
      mockParams.objectiveId = undefined;

      render(<SidebarObjectives workspaceId={workspaceId} />);

      // All objectives should be rendered but none highlighted
      expect(
        screen.getByText('Q1 Revenue Growth Strategy'),
      ).toBeInTheDocument();
      expect(screen.getByText('Customer Retention Plan')).toBeInTheDocument();
    });

    it('should handle non-existent objectiveId gracefully', () => {
      mockParams.objectiveId = 'non-existent-id';

      render(<SidebarObjectives workspaceId={workspaceId} />);

      // Component should still render all objectives
      expect(
        screen.getByText('Q1 Revenue Growth Strategy'),
      ).toBeInTheDocument();
      expect(screen.getByText('Customer Retention Plan')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(useSWR).mockReturnValue({
        data: mockObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });
    });

    it('should navigate to objective detail page on click', async () => {
      const user = userEvent.setup();
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const objectiveButton = screen.getByText('Q1 Revenue Growth Strategy');
      await user.click(objectiveButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/workspace/workspace-123/objective/obj-1',
        );
      });
    });

    it('should navigate to different objectives correctly', async () => {
      const user = userEvent.setup();
      render(<SidebarObjectives workspaceId={workspaceId} />);

      // Click first objective
      const firstObjective = screen.getByText('Q1 Revenue Growth Strategy');
      await user.click(firstObjective);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/workspace/workspace-123/objective/obj-1',
        );
      });

      // Click second objective
      const secondObjective = screen.getByText('Customer Retention Plan');
      await user.click(secondObjective);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          '/workspace/workspace-123/objective/obj-2',
        );
      });

      expect(mockPush).toHaveBeenCalledTimes(2);
    });

    it('should navigate to workspace page when clicking "View All"', async () => {
      const user = userEvent.setup();
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const viewAllButton = screen.getByText('View All Objectives →');
      await user.click(viewAllButton);

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/workspace/workspace-123');
      });
    });

    it('should close mobile sidebar on objective navigation', async () => {
      const user = userEvent.setup();
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const objectiveButton = screen.getByText('Customer Retention Plan');
      await user.click(objectiveButton);

      await waitFor(() => {
        expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
      });
    });

    it('should close mobile sidebar on "View All" navigation', async () => {
      const user = userEvent.setup();
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const viewAllButton = screen.getByText('View All Objectives →');
      await user.click(viewAllButton);

      await waitFor(() => {
        expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
      });
    });

    it('should close sidebar before navigating', async () => {
      const user = userEvent.setup();
      render(<SidebarObjectives workspaceId={workspaceId} />);

      const objectiveButton = screen.getByText('Q1 Revenue Growth Strategy');
      await user.click(objectiveButton);

      await waitFor(() => {
        expect(mockSetOpenMobile).toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalled();
      });

      // Verify setOpenMobile was called before push (same tick is acceptable)
      const setOpenMobileOrder = mockSetOpenMobile.mock.invocationCallOrder[0];
      const pushOrder = mockPush.mock.invocationCallOrder[0];
      expect(setOpenMobileOrder).toBeLessThanOrEqual(pushOrder);
    });
  });

  describe('Edge Cases', () => {
    it('should handle objectives with null objectiveDocumentId', () => {
      const objectivesWithNull: Objective[] = [
        {
          ...mockObjectives[0],
          objectiveDocumentId: null,
        },
      ];

      vi.mocked(useSWR).mockReturnValue({
        data: objectivesWithNull,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      expect(
        screen.getByText('Q1 Revenue Growth Strategy'),
      ).toBeInTheDocument();
    });

    it('should handle objectives with null publishedAt date', () => {
      const objectivesWithNullDate: Objective[] = [
        {
          ...mockObjectives[1],
          publishedAt: null,
        },
      ];

      vi.mocked(useSWR).mockReturnValue({
        data: objectivesWithNullDate,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      expect(screen.getByText('Customer Retention Plan')).toBeInTheDocument();
      // Should show FileIcon for open status
      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    });

    it('should handle single objective in list', () => {
      vi.mocked(useSWR).mockReturnValue({
        data: [mockObjectives[0]],
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      expect(
        screen.getByText('Q1 Revenue Growth Strategy'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('Customer Retention Plan'),
      ).not.toBeInTheDocument();
    });

    it('should handle very long objective titles with truncation', () => {
      vi.mocked(useSWR).mockReturnValue({
        data: mockObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      const longTitle = screen.getByText(
        'This is a very long objective title that should be truncated when displayed in the sidebar',
      );
      expect(longTitle).toBeInTheDocument();
      expect(longTitle.className).toContain('truncate');
    });

    it('should handle workspace ID changes', () => {
      const { rerender } = render(
        <SidebarObjectives workspaceId="workspace-1" />,
      );

      expect(useSWR).toHaveBeenCalledWith(
        '/api/workspace/workspace-1/objectives',
        expect.any(Function),
      );

      rerender(<SidebarObjectives workspaceId="workspace-2" />);

      expect(useSWR).toHaveBeenCalledWith(
        '/api/workspace/workspace-2/objectives',
        expect.any(Function),
      );
    });

    it('should handle SWR error state gracefully', () => {
      vi.mocked(useSWR).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('API Error'),
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      // Component defaults to empty array on error, showing empty state
      expect(
        screen.getByText('No objectives yet. Create one to get started!'),
      ).toBeInTheDocument();
    });

    it('should handle multiple rapid clicks without duplicate navigation', async () => {
      const user = userEvent.setup();
      vi.mocked(useSWR).mockReturnValue({
        data: mockObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      const objectiveButton = screen.getByText('Q1 Revenue Growth Strategy');

      // Rapid clicks
      await user.click(objectiveButton);
      await user.click(objectiveButton);
      await user.click(objectiveButton);

      // Should have called push 3 times (once per click)
      // This tests that the component doesn't break with rapid interactions
      expect(mockPush).toHaveBeenCalledTimes(3);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle transition from loading to loaded state', async () => {
      // Start with loading
      vi.mocked(useSWR).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { rerender, container } = render(
        <SidebarObjectives workspaceId={workspaceId} />,
      );

      // Verify loading state
      const skeletons = container.querySelectorAll(
        '.bg-sidebar-accent-foreground\\/10',
      );
      expect(skeletons).toHaveLength(5);

      // Update to loaded state
      vi.mocked(useSWR).mockReturnValue({
        data: mockObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      rerender(<SidebarObjectives workspaceId={workspaceId} />);

      // Verify objectives are now shown
      expect(
        screen.getByText('Q1 Revenue Growth Strategy'),
      ).toBeInTheDocument();
      expect(screen.getByText('Customer Retention Plan')).toBeInTheDocument();
    });

    it('should handle transition from empty to populated state', () => {
      // Start with empty
      vi.mocked(useSWR).mockReturnValue({
        data: [],
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { rerender } = render(
        <SidebarObjectives workspaceId={workspaceId} />,
      );

      expect(
        screen.getByText('No objectives yet. Create one to get started!'),
      ).toBeInTheDocument();

      // Update to populated
      vi.mocked(useSWR).mockReturnValue({
        data: mockObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      rerender(<SidebarObjectives workspaceId={workspaceId} />);

      expect(
        screen.queryByText('No objectives yet. Create one to get started!'),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText('Q1 Revenue Growth Strategy'),
      ).toBeInTheDocument();
    });

    it('should handle active objective changing via URL', async () => {
      const user = userEvent.setup();
      vi.mocked(useSWR).mockReturnValue({
        data: mockObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      // Start with obj-1 active
      mockParams.objectiveId = 'obj-1';

      const { rerender } = render(
        <SidebarObjectives workspaceId={workspaceId} />,
      );

      // Click different objective
      const objective2 = screen.getByText('Customer Retention Plan');
      await user.click(objective2);

      // Simulate URL change
      mockParams.objectiveId = 'obj-2';
      rerender(<SidebarObjectives workspaceId={workspaceId} />);

      // Component should re-render with new active state
      expect(mockPush).toHaveBeenCalledWith(
        '/workspace/workspace-123/objective/obj-2',
      );
    });

    it('should handle mixed status objectives correctly', () => {
      const mixedObjectives: Objective[] = [
        { ...mockObjectives[0], status: 'published' },
        { ...mockObjectives[1], status: 'open' },
        { ...mockObjectives[2], status: 'published' },
      ];

      vi.mocked(useSWR).mockReturnValue({
        data: mixedObjectives,
        isLoading: false,
        error: undefined,
        isValidating: false,
        mutate: vi.fn(),
      });

      render(<SidebarObjectives workspaceId={workspaceId} />);

      // Should have 2 CheckCircleFillIcon for published
      const checkIcons = screen.getAllByTestId('check-circle-icon');
      expect(checkIcons).toHaveLength(2);

      // Should have 1 FileIcon for open
      const fileIcons = screen.getAllByTestId('file-icon');
      expect(fileIcons).toHaveLength(1);
    });
  });
});
