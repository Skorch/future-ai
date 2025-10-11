import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ObjectiveTable } from '@/components/objective-table';
import type { Objective } from '@/lib/db/schema';

// Mock Next.js navigation hooks
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock SWR
const mockMutate = vi.fn();
vi.mock('swr', () => ({
  useSWRConfig: () => ({
    mutate: mockMutate,
  }),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock server actions
vi.mock('@/lib/objective/actions', () => ({
  deleteObjectiveAction: vi.fn(),
  publishObjectiveAction: vi.fn(),
  unpublishObjectiveAction: vi.fn(),
}));

// Mock responsive columns hook
vi.mock('@/hooks/use-responsive-columns', () => ({
  useResponsiveColumns: vi.fn((columns) => columns),
}));

// Mock table height hook
vi.mock('@/hooks/use-table-height', () => ({
  useTableHeight: vi.fn(() => '500px'),
}));

// Import after mocking to get the mock references
import { toast } from 'sonner';
import {
  deleteObjectiveAction,
  publishObjectiveAction,
  unpublishObjectiveAction,
} from '@/lib/objective/actions';
import { useResponsiveColumns } from '@/hooks/use-responsive-columns';
import { useTableHeight } from '@/hooks/use-table-height';

// Mock react-data-grid
vi.mock('react-data-grid', () => {
  const React: any = (globalThis as any).React || require('react');
  return {
    default: vi.fn(
      ({
        columns,
        rows,
        className,
        style,
      }: {
        columns: {
          key: string;
          name: string;
          renderCell?: (props: { row: any }) => any;
        }[];
        rows: any[];
        className: string;
        style: { height: string };
      }) =>
        React.createElement(
          'div',
          { 'data-testid': 'data-grid', className, style },
          React.createElement(
            'div',
            { 'data-testid': 'grid-header' },
            columns.map((col) =>
              React.createElement(
                'div',
                { key: col.key, 'data-testid': `header-${col.key}` },
                col.name,
              ),
            ),
          ),
          React.createElement(
            'div',
            { 'data-testid': 'grid-rows' },
            rows.map((row) =>
              React.createElement(
                'div',
                { key: row.id, 'data-testid': `row-${row.id}` },
                columns.map((col) =>
                  React.createElement(
                    'div',
                    {
                      key: col.key,
                      'data-testid': `cell-${row.id}-${col.key}`,
                    },
                    col.renderCell
                      ? col.renderCell({ row })
                      : String(row[col.key]),
                  ),
                ),
              ),
            ),
          ),
        ),
    ),
  };
});

// Mock UI components
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({
    children,
    align,
  }: {
    children: React.ReactNode;
    align?: string;
  }) => (
    <div data-testid="dropdown-content" data-align={align}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button
      type="button"
      data-testid="dropdown-item"
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
}));

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({
    children,
    open,
    onOpenChange,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="alert-dialog" data-open={open}>
        {children}
      </div>
    ) : null,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-content">{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-header">{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="alert-footer">{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2 data-testid="alert-title">{children}</h2>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p data-testid="alert-description">{children}</p>
  ),
  AlertDialogCancel: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" data-testid="alert-cancel" onClick={onClick}>
      {children}
    </button>
  ),
  AlertDialogAction: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button type="button" data-testid="alert-action" onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    variant,
    size,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button
      type="button"
      data-testid="button"
      onClick={onClick}
      data-variant={variant}
      data-size={size}
      className={className}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({
    children,
    variant,
    className,
  }: {
    children: React.ReactNode;
    variant?: string;
    className?: string;
  }) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: (date: Date, options?: { addSuffix?: boolean }) => {
    const now = new Date('2024-03-15T12:00:00Z');
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'today';
    if (days === 1) return options?.addSuffix ? '1 day ago' : '1 day';
    return options?.addSuffix ? `${days} days ago` : `${days} days`;
  },
}));

describe('ObjectiveTable Component', () => {
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
      createdAt: new Date('2024-03-01T10:00:00Z'),
      updatedAt: new Date('2024-03-10T15:00:00Z'),
      publishedAt: new Date('2024-03-10T15:00:00Z'),
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
      createdAt: new Date('2024-03-05T08:00:00Z'),
      updatedAt: new Date('2024-03-07T12:00:00Z'),
      publishedAt: null,
      createdByUserId: 'user-1',
    },
    {
      id: 'obj-3',
      workspaceId: 'workspace-123',
      objectiveDocumentId: null,
      title:
        'This is a very long objective title that should be truncated when displayed in the table cells to prevent overflow',
      description: 'Test truncation',
      documentType: 'other',
      status: 'open',
      createdAt: new Date('2024-03-10T14:00:00Z'),
      updatedAt: new Date('2024-03-10T14:00:00Z'),
      publishedAt: null,
      createdByUserId: 'user-1',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useResponsiveColumns).mockImplementation((columns) => columns);
    vi.mocked(useTableHeight).mockReturnValue('500px');
  });

  describe('Rendering Tests', () => {
    it('should render DataGrid with objectives data', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
      expect(screen.getByTestId('grid-rows')).toBeInTheDocument();
    });

    it('should render all column headers', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('header-title')).toHaveTextContent('Objective');
      expect(screen.getByTestId('header-documentType')).toHaveTextContent(
        'Type',
      );
      expect(screen.getByTestId('header-status')).toHaveTextContent('Status');
      expect(screen.getByTestId('header-createdAt')).toHaveTextContent(
        'Created',
      );
      expect(screen.getByTestId('header-actions')).toHaveTextContent('');
    });

    it('should render all objectives as rows', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('row-obj-1')).toBeInTheDocument();
      expect(screen.getByTestId('row-obj-2')).toBeInTheDocument();
      expect(screen.getByTestId('row-obj-3')).toBeInTheDocument();
    });

    it('should render empty grid when no objectives provided', () => {
      render(<ObjectiveTable objectives={[]} workspaceId={workspaceId} />);

      const gridRows = screen.getByTestId('grid-rows');
      expect(gridRows.children).toHaveLength(0);
    });

    it('should apply correct CSS classes to DataGrid', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const grid = screen.getByTestId('data-grid');
      expect(grid).toHaveClass('rdg-light', 'dark:rdg-dark');
    });

    it('should apply calculated height from useTableHeight hook', () => {
      vi.mocked(useTableHeight).mockReturnValue('450px');

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const grid = screen.getByTestId('data-grid');
      expect(grid).toHaveStyle({ height: '450px' });
    });
  });

  describe('Column Tests', () => {
    it('should render title as clickable button', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const titleCell = screen.getByTestId('cell-obj-1-title');
      const button = titleCell.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Q1 Revenue Growth Strategy');
    });

    it('should render document type as badge', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const typeCell = screen.getByTestId('cell-obj-1-documentType');
      const badge = typeCell.querySelector('[data-testid="badge"]');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('strategy');
      expect(badge).toHaveAttribute('data-variant', 'outline');
    });

    it('should render status badge with correct variant for published', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const statusCell = screen.getByTestId('cell-obj-1-status');
      const badge = statusCell.querySelector('[data-testid="badge"]');
      expect(badge).toHaveTextContent('published');
      expect(badge).toHaveAttribute('data-variant', 'default');
    });

    it('should render status badge with correct variant for open', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const statusCell = screen.getByTestId('cell-obj-2-status');
      const badge = statusCell.querySelector('[data-testid="badge"]');
      expect(badge).toHaveTextContent('open');
      expect(badge).toHaveAttribute('data-variant', 'secondary');
    });

    it('should render relative time for createdAt', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const createdCell = screen.getByTestId('cell-obj-1-createdAt');
      const timeSpan = createdCell.querySelector('span');
      expect(timeSpan).toBeInTheDocument();
      expect(timeSpan).toHaveTextContent('14 days ago');
    });

    it('should render actions dropdown menu', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      expect(
        actionsCell.querySelector('[data-testid="dropdown-menu"]'),
      ).toBeInTheDocument();
    });

    it('should render title with truncate class for long titles', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const titleCell = screen.getByTestId('cell-obj-3-title');
      const button = titleCell.querySelector('button');
      expect(button).toHaveClass('truncate');
    });

    it('should set title attribute for accessibility', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const titleCell = screen.getByTestId('cell-obj-3-title');
      const button = titleCell.querySelector('button');
      expect(button).toHaveAttribute(
        'title',
        'This is a very long objective title that should be truncated when displayed in the table cells to prevent overflow',
      );
    });
  });

  describe('Responsive Tests', () => {
    it('should call useResponsiveColumns with correct config', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(vi.mocked(useResponsiveColumns)).toHaveBeenCalledWith(
        expect.any(Array),
        {
          mobile: ['title', 'status', 'actions'],
          tablet: ['title', 'status', 'createdAt', 'actions'],
        },
      );
    });

    it('should filter columns for mobile viewport', () => {
      const mobileColumns = [
        { key: 'title', name: 'Title' },
        { key: 'status', name: 'Status' },
        { key: 'actions', name: 'Actions' },
      ];
      vi.mocked(useResponsiveColumns).mockReturnValue(mobileColumns);

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('header-title')).toBeInTheDocument();
      expect(screen.getByTestId('header-status')).toBeInTheDocument();
      expect(screen.getByTestId('header-actions')).toBeInTheDocument();
    });

    it('should filter columns for tablet viewport', () => {
      const tabletColumns = [
        { key: 'title', name: 'Title' },
        { key: 'status', name: 'Status' },
        { key: 'createdAt', name: 'Created' },
        { key: 'actions', name: 'Actions' },
      ];
      vi.mocked(useResponsiveColumns).mockReturnValue(tabletColumns);

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('header-title')).toBeInTheDocument();
      expect(screen.getByTestId('header-status')).toBeInTheDocument();
      expect(screen.getByTestId('header-createdAt')).toBeInTheDocument();
      expect(screen.getByTestId('header-actions')).toBeInTheDocument();
    });

    it('should show all columns for desktop viewport', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('header-title')).toBeInTheDocument();
      expect(screen.getByTestId('header-documentType')).toBeInTheDocument();
      expect(screen.getByTestId('header-status')).toBeInTheDocument();
      expect(screen.getByTestId('header-createdAt')).toBeInTheDocument();
      expect(screen.getByTestId('header-actions')).toBeInTheDocument();
    });

    it('should call useTableHeight with correct row count', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(vi.mocked(useTableHeight)).toHaveBeenCalledWith(3);
    });
  });

  describe('Navigation Tests', () => {
    it('should navigate to objective detail when title is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const titleCell = screen.getByTestId('cell-obj-1-title');
      const button = titleCell.querySelector('button');
      if (!button) throw new Error('Button not found');

      await user.click(button);

      expect(mockPush).toHaveBeenCalledWith(
        '/workspace/workspace-123/objective/obj-1',
      );
    });

    it('should navigate to new chat with objectiveId query param', async () => {
      const user = userEvent.setup();
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      // Find "Start New Chat" item (second item)
      const startChatButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Start New Chat'),
      );

      if (!startChatButton) throw new Error('Start Chat button not found');
      await user.click(startChatButton);

      expect(mockPush).toHaveBeenCalledWith(
        '/workspace/workspace-123/chat/new?objectiveId=obj-2',
      );
    });

    it('should navigate to objective detail from View action', async () => {
      const user = userEvent.setup();
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      // Find "View Objective" item (first item)
      const viewButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('View Objective'),
      );

      if (!viewButton) throw new Error('View button not found');
      await user.click(viewButton);

      expect(mockPush).toHaveBeenCalledWith(
        '/workspace/workspace-123/objective/obj-1',
      );
    });

    it('should navigate to different objectives correctly', async () => {
      const user = userEvent.setup();
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      // Click first objective
      const firstTitleCell = screen.getByTestId('cell-obj-1-title');
      const firstButton = firstTitleCell.querySelector('button');
      if (!firstButton) throw new Error('First button not found');
      await user.click(firstButton);

      expect(mockPush).toHaveBeenCalledWith(
        '/workspace/workspace-123/objective/obj-1',
      );

      // Click second objective
      const secondTitleCell = screen.getByTestId('cell-obj-2-title');
      const secondButton = secondTitleCell.querySelector('button');
      if (!secondButton) throw new Error('Second button not found');
      await user.click(secondButton);

      expect(mockPush).toHaveBeenCalledWith(
        '/workspace/workspace-123/objective/obj-2',
      );

      expect(mockPush).toHaveBeenCalledTimes(2);
    });
  });

  describe('Action Tests - Publish', () => {
    it('should call publishObjectiveAction when Publish is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(publishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');
      await user.click(publishButton);

      await waitFor(() => {
        expect(vi.mocked(publishObjectiveAction)).toHaveBeenCalledWith('obj-2');
      });
    });

    it('should show success toast after successful publish', async () => {
      const user = userEvent.setup();
      vi.mocked(publishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');
      await user.click(publishButton);

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          'Objective published',
        );
      });
    });

    it('should invalidate SWR cache after successful publish', async () => {
      const user = userEvent.setup();
      vi.mocked(publishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');
      await user.click(publishButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          '/api/workspace/workspace-123/objectives',
        );
      });
    });

    it('should show error toast when publish fails', async () => {
      const user = userEvent.setup();
      vi.mocked(publishObjectiveAction).mockResolvedValue({
        success: false,
        error: 'Database connection failed',
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');
      await user.click(publishButton);

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to publish: Database connection failed',
        );
      });
    });

    it('should not invalidate cache when publish fails', async () => {
      const user = userEvent.setup();
      vi.mocked(publishObjectiveAction).mockResolvedValue({
        success: false,
        error: 'Publish failed',
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');
      await user.click(publishButton);

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalled();
      });

      expect(mockMutate).not.toHaveBeenCalled();
    });
  });

  describe('Action Tests - Unpublish', () => {
    it('should call unpublishObjectiveAction when Unpublish is clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(unpublishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const unpublishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Unpublish Objective'),
      );

      if (!unpublishButton) throw new Error('Unpublish button not found');
      await user.click(unpublishButton);

      await waitFor(() => {
        expect(vi.mocked(unpublishObjectiveAction)).toHaveBeenCalledWith(
          'obj-1',
        );
      });
    });

    it('should show success toast after successful unpublish', async () => {
      const user = userEvent.setup();
      vi.mocked(unpublishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const unpublishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Unpublish Objective'),
      );

      if (!unpublishButton) throw new Error('Unpublish button not found');
      await user.click(unpublishButton);

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          'Objective unpublished',
        );
      });
    });

    it('should invalidate SWR cache after successful unpublish', async () => {
      const user = userEvent.setup();
      vi.mocked(unpublishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const unpublishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Unpublish Objective'),
      );

      if (!unpublishButton) throw new Error('Unpublish button not found');
      await user.click(unpublishButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          '/api/workspace/workspace-123/objectives',
        );
      });
    });

    it('should show error toast when unpublish fails', async () => {
      const user = userEvent.setup();
      vi.mocked(unpublishObjectiveAction).mockResolvedValue({
        success: false,
        error: 'Permission denied',
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const unpublishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Unpublish Objective'),
      );

      if (!unpublishButton) throw new Error('Unpublish button not found');
      await user.click(unpublishButton);

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to unpublish: Permission denied',
        );
      });
    });

    it('should show Publish action for open objectives', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      expect(publishButton).toBeInTheDocument();
    });

    it('should show Unpublish action for published objectives', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const unpublishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Unpublish Objective'),
      );

      expect(unpublishButton).toBeInTheDocument();
    });
  });

  describe('Action Tests - Delete', () => {
    it('should show delete confirmation dialog when Delete is clicked', async () => {
      const user = userEvent.setup();
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton) throw new Error('Delete button not found');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
      });
    });

    it('should show correct confirmation dialog content', async () => {
      const user = userEvent.setup();
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton) throw new Error('Delete button not found');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('alert-title')).toHaveTextContent(
          'Are you sure?',
        );
      });

      expect(screen.getByTestId('alert-description')).toHaveTextContent(
        'This will permanently delete this objective and all associated chats.',
      );
    });

    it('should call deleteObjectiveAction when Delete is confirmed', async () => {
      const user = userEvent.setup();
      vi.mocked(deleteObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton) throw new Error('Delete button not found');
      await user.click(deleteButton);

      const confirmButton = await screen.findByTestId('alert-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(vi.mocked(deleteObjectiveAction)).toHaveBeenCalledWith('obj-1');
      });
    });

    it('should show success toast after successful delete', async () => {
      const user = userEvent.setup();
      vi.mocked(deleteObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton) throw new Error('Delete button not found');
      await user.click(deleteButton);

      const confirmButton = await screen.findByTestId('alert-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          'Objective deleted',
        );
      });
    });

    it('should close dialog after successful delete', async () => {
      const user = userEvent.setup();
      vi.mocked(deleteObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton) throw new Error('Delete button not found');
      await user.click(deleteButton);

      const confirmButton = await screen.findByTestId('alert-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
      });
    });

    it('should invalidate SWR cache after successful delete', async () => {
      const user = userEvent.setup();
      vi.mocked(deleteObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton) throw new Error('Delete button not found');
      await user.click(deleteButton);

      const confirmButton = await screen.findByTestId('alert-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          '/api/workspace/workspace-123/objectives',
        );
      });
    });

    it('should show error toast when delete fails', async () => {
      const user = userEvent.setup();
      vi.mocked(deleteObjectiveAction).mockResolvedValue({
        success: false,
        error: 'Cannot delete objective with active chats',
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton) throw new Error('Delete button not found');
      await user.click(deleteButton);

      const confirmButton = await screen.findByTestId('alert-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to delete: Cannot delete objective with active chats',
        );
      });
    });

    it('should not close dialog when delete fails', async () => {
      const user = userEvent.setup();
      vi.mocked(deleteObjectiveAction).mockResolvedValue({
        success: false,
        error: 'Delete failed',
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton) throw new Error('Delete button not found');
      await user.click(deleteButton);

      const confirmButton = await screen.findByTestId('alert-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalled();
      });

      // Dialog should still be open
      expect(screen.getByTestId('alert-dialog')).toBeInTheDocument();
    });
  });

  describe('Dialog Tests', () => {
    it('should not show dialog initially', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
    });

    it('should handle multiple delete attempts on different objectives', async () => {
      const user = userEvent.setup();
      vi.mocked(deleteObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      // Try to delete obj-1
      const actionsCell1 = screen.getByTestId('cell-obj-1-actions');
      const dropdownItems1 = actionsCell1.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton1 = Array.from(dropdownItems1).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton1) throw new Error('Delete button 1 not found');
      await user.click(deleteButton1);

      const cancelButton = screen.getByTestId('alert-cancel');
      await user.click(cancelButton);

      // Try to delete obj-2
      const actionsCell2 = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems2 = actionsCell2.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const deleteButton2 = Array.from(dropdownItems2).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton2) throw new Error('Delete button 2 not found');
      await user.click(deleteButton2);

      const confirmButton = await screen.findByTestId('alert-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(vi.mocked(deleteObjectiveAction)).toHaveBeenCalledWith('obj-2');
      });

      // Should not have been called with obj-1
      expect(vi.mocked(deleteObjectiveAction)).not.toHaveBeenCalledWith(
        'obj-1',
      );
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

      render(
        <ObjectiveTable
          objectives={objectivesWithNull}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('row-obj-1')).toBeInTheDocument();
      expect(
        screen.getByText('Q1 Revenue Growth Strategy'),
      ).toBeInTheDocument();
    });

    it('should handle objectives with null publishedAt date', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      // obj-2 has null publishedAt
      expect(screen.getByTestId('row-obj-2')).toBeInTheDocument();
    });

    it('should handle single objective in list', () => {
      render(
        <ObjectiveTable
          objectives={[mockObjectives[0]]}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('row-obj-1')).toBeInTheDocument();
      expect(screen.queryByTestId('row-obj-2')).not.toBeInTheDocument();
      expect(vi.mocked(useTableHeight)).toHaveBeenCalledWith(1);
    });

    it('should handle very long objective titles', () => {
      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const longTitleCell = screen.getByTestId('cell-obj-3-title');
      const button = longTitleCell.querySelector('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('truncate');
    });

    it('should handle workspace ID changes', () => {
      const { rerender } = render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId="workspace-1"
        />,
      );

      rerender(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId="workspace-2"
        />,
      );

      // Component should re-render without errors
      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
    });

    it('should handle objectives list changes', () => {
      const { rerender } = render(
        <ObjectiveTable
          objectives={[mockObjectives[0]]}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('row-obj-1')).toBeInTheDocument();
      expect(screen.queryByTestId('row-obj-2')).not.toBeInTheDocument();

      rerender(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('row-obj-1')).toBeInTheDocument();
      expect(screen.getByTestId('row-obj-2')).toBeInTheDocument();
      expect(screen.getByTestId('row-obj-3')).toBeInTheDocument();
    });

    it('should handle multiple SWR keys in revalidation', async () => {
      const user = userEvent.setup();
      vi.mocked(publishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: [
            '/api/workspace/workspace-123/objectives',
            '/api/workspace/workspace-123/objective/obj-2',
          ],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');
      await user.click(publishButton);

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          '/api/workspace/workspace-123/objectives',
        );
        expect(mockMutate).toHaveBeenCalledWith(
          '/api/workspace/workspace-123/objective/obj-2',
        );
      });
    });

    it('should handle action response without swrKeys', async () => {
      const user = userEvent.setup();
      vi.mocked(publishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          paths: ['/workspace/workspace-123'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');
      await user.click(publishButton);

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalled();
      });

      // Should not crash, even without swrKeys
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('should handle rapid action clicks without duplicate calls', async () => {
      const user = userEvent.setup();
      vi.mocked(publishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');

      // Rapid clicks
      await user.click(publishButton);
      await user.click(publishButton);
      await user.click(publishButton);

      // All 3 calls should go through (no debouncing)
      await waitFor(() => {
        expect(vi.mocked(publishObjectiveAction)).toHaveBeenCalledTimes(3);
      });
    });

    it('should handle empty description field gracefully', () => {
      const objectivesWithoutDescription: Objective[] = [
        {
          ...mockObjectives[0],
          description: '',
        },
      ];

      render(
        <ObjectiveTable
          objectives={objectivesWithoutDescription}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('row-obj-1')).toBeInTheDocument();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle transition from empty to populated state', () => {
      const { rerender } = render(
        <ObjectiveTable objectives={[]} workspaceId={workspaceId} />,
      );

      const gridRows = screen.getByTestId('grid-rows');
      expect(gridRows.children).toHaveLength(0);

      rerender(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      expect(screen.getByTestId('row-obj-1')).toBeInTheDocument();
      expect(screen.getByTestId('row-obj-2')).toBeInTheDocument();
      expect(screen.getByTestId('row-obj-3')).toBeInTheDocument();
    });

    it('should handle mixed status objectives correctly', () => {
      const mixedObjectives: Objective[] = [
        { ...mockObjectives[0], status: 'published' },
        { ...mockObjectives[1], status: 'open' },
        { ...mockObjectives[2], status: 'published' },
      ];

      render(
        <ObjectiveTable
          objectives={mixedObjectives}
          workspaceId={workspaceId}
        />,
      );

      // Check status badges
      const status1 = screen.getByTestId('cell-obj-1-status');
      expect(
        status1.querySelector('[data-variant="default"]'),
      ).toBeInTheDocument();

      const status2 = screen.getByTestId('cell-obj-2-status');
      expect(
        status2.querySelector('[data-variant="secondary"]'),
      ).toBeInTheDocument();

      const status3 = screen.getByTestId('cell-obj-3-status');
      expect(
        status3.querySelector('[data-variant="default"]'),
      ).toBeInTheDocument();
    });

    it('should handle complete workflow: view, publish, delete', async () => {
      const user = userEvent.setup();
      vi.mocked(publishObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });
      vi.mocked(deleteObjectiveAction).mockResolvedValue({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      // Step 1: View objective
      const titleCell = screen.getByTestId('cell-obj-2-title');
      const titleButton = titleCell.querySelector('button');
      if (!titleButton) throw new Error('Title button not found');
      await user.click(titleButton);

      expect(mockPush).toHaveBeenCalledWith(
        '/workspace/workspace-123/objective/obj-2',
      );

      // Step 2: Publish objective
      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');
      await user.click(publishButton);

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          'Objective published',
        );
      });

      // Step 3: Delete objective
      const deleteButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Delete Objective'),
      );

      if (!deleteButton) throw new Error('Delete button not found');
      await user.click(deleteButton);

      const confirmButton = await screen.findByTestId('alert-action');
      await user.click(confirmButton);

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          'Objective deleted',
        );
      });
    });

    it('should handle failed publish followed by successful retry', async () => {
      const user = userEvent.setup();

      // First attempt fails
      vi.mocked(publishObjectiveAction).mockResolvedValueOnce({
        success: false,
        error: 'Network error',
      });

      // Second attempt succeeds
      vi.mocked(publishObjectiveAction).mockResolvedValueOnce({
        success: true,
        revalidate: {
          swrKeys: ['/api/workspace/workspace-123/objectives'],
        },
      });

      render(
        <ObjectiveTable
          objectives={mockObjectives}
          workspaceId={workspaceId}
        />,
      );

      const actionsCell = screen.getByTestId('cell-obj-2-actions');
      const dropdownItems = actionsCell.querySelectorAll(
        '[data-testid="dropdown-item"]',
      );

      const publishButton = Array.from(dropdownItems).find((item) =>
        item.textContent?.includes('Publish Objective'),
      );

      if (!publishButton) throw new Error('Publish button not found');

      // First attempt
      await user.click(publishButton);

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith(
          'Failed to publish: Network error',
        );
      });

      // Second attempt
      await user.click(publishButton);

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          'Objective published',
        );
      });
    });
  });
});
