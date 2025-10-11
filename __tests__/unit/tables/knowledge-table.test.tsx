import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { KnowledgeTable } from '@/components/knowledge-table';
import type { KnowledgeDocument } from '@/lib/db/schema';

// Mock react-data-grid
vi.mock('react-data-grid', () => ({
  default: ({
    columns,
    rows,
    className,
    style,
  }: {
    columns: any[];
    rows: any[];
    className?: string;
    style?: any;
  }) => (
    <div data-testid="data-grid" className={className} style={style}>
      <div data-testid="columns">{columns.length}</div>
      <div data-testid="rows">{rows.length}</div>
      {rows.map((row) => (
        <div key={row.id} data-testid={`row-${row.id}`}>
          {columns.map((col) => (
            <div key={col.key} data-testid={`cell-${row.id}-${col.key}`}>
              {col.renderCell
                ? col.renderCell({ row })
                : String(row[col.key] ?? '')}
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
}));

// Mock hooks
vi.mock('@/hooks/use-responsive-columns', () => ({
  useResponsiveColumns: vi.fn((columns) => columns),
}));

vi.mock('@/hooks/use-table-height', () => ({
  useTableHeight: vi.fn(() => '500px'),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  formatDistanceToNow: vi.fn(() => '2 days ago'),
}));

// Mock icons
vi.mock('lucide-react', () => ({
  SearchIcon: () => <svg data-testid="search-icon" />,
}));

// Helper to create mock knowledge documents
const createMockDocument = (
  overrides?: Partial<KnowledgeDocument>,
): KnowledgeDocument => ({
  id: 'doc-1',
  workspaceId: 'ws-1',
  objectiveId: null,
  title: 'Test Document',
  content: 'This is test content for the document',
  category: 'knowledge' as const,
  documentType: 'summary',
  isSearchable: true,
  metadata: null,
  createdByUserId: 'user-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
});

describe('KnowledgeTable', () => {
  const defaultProps = {
    documents: [
      createMockDocument({
        id: 'doc-1',
        title: 'Q4 Planning Summary',
        content: 'Summary of Q4 planning discussions',
        documentType: 'summary',
      }),
      createMockDocument({
        id: 'doc-2',
        title: 'Meeting Transcript',
        content: 'Raw transcript from team meeting',
        documentType: 'transcript',
        objectiveId: 'obj-1',
      }),
    ],
    workspaceId: 'ws-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('should render DataGrid with documents', () => {
      render(<KnowledgeTable {...defaultProps} />);

      expect(screen.getByTestId('data-grid')).toBeInTheDocument();
      expect(screen.getByTestId('rows')).toHaveTextContent('2');
    });

    it('should render search input', () => {
      render(<KnowledgeTable {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents...');
      expect(searchInput).toBeInTheDocument();
    });

    it('should render search icon', () => {
      render(<KnowledgeTable {...defaultProps} />);

      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    it('should have correct DataGrid CSS classes', () => {
      render(<KnowledgeTable {...defaultProps} />);

      const grid = screen.getByTestId('data-grid');
      expect(grid.className).toContain('rdg-light');
      expect(grid.className).toContain('dark:rdg-dark');
    });

    it('should apply dynamic height from hook', async () => {
      const { useTableHeight } = await import('@/hooks/use-table-height');
      vi.mocked(useTableHeight).mockReturnValue('450px');

      render(<KnowledgeTable {...defaultProps} />);

      const grid = screen.getByTestId('data-grid');
      expect(grid.style.height).toBe('450px');
    });

    it('should render all documents as rows', () => {
      render(<KnowledgeTable {...defaultProps} />);

      expect(screen.getByTestId('row-doc-1')).toBeInTheDocument();
      expect(screen.getByTestId('row-doc-2')).toBeInTheDocument();
    });
  });

  describe('Columns', () => {
    it('should render all 5 columns', () => {
      render(<KnowledgeTable {...defaultProps} />);

      expect(screen.getByTestId('columns')).toHaveTextContent('5');
    });

    it('should render Title column with document title and preview', () => {
      render(<KnowledgeTable {...defaultProps} />);

      // Title
      expect(screen.getByText('Q4 Planning Summary')).toBeInTheDocument();
      // Content preview
      expect(
        screen.getByText('Summary of Q4 planning discussions'),
      ).toBeInTheDocument();
    });

    it('should render Type column with badge', () => {
      render(<KnowledgeTable {...defaultProps} />);

      const cell = screen.getByTestId('cell-doc-1-documentType');
      expect(cell.textContent).toBe('summary');
    });

    it('should render Objective column as "Workspace-level" when no objectiveId', () => {
      render(<KnowledgeTable {...defaultProps} />);

      const cell = screen.getByTestId('cell-doc-1-objective');
      expect(cell.textContent).toBe('Workspace-level');
    });

    it('should render Objective column as "Linked" when objectiveId exists', () => {
      render(<KnowledgeTable {...defaultProps} />);

      const cell = screen.getByTestId('cell-doc-2-objective');
      expect(cell.textContent).toBe('Linked');
    });

    it('should render Created column with relative time', () => {
      render(<KnowledgeTable {...defaultProps} />);

      const cell = screen.getByTestId('cell-doc-1-createdAt');
      expect(cell.textContent).toBe('2 days ago');
    });

    it('should render Size column with KB calculation', () => {
      render(<KnowledgeTable {...defaultProps} />);

      const cell = screen.getByTestId('cell-doc-1-size');
      expect(cell.textContent).toMatch(/\d+\.\d+ KB/);
    });

    it('should calculate size correctly', () => {
      const doc = createMockDocument({
        id: 'doc-1',
        content: 'x'.repeat(2048), // 2 KB
      });

      render(<KnowledgeTable documents={[doc]} workspaceId="ws-1" />);

      const cell = screen.getByTestId('cell-doc-1-size');
      expect(cell.textContent).toBe('2.0 KB');
    });
  });

  describe('Responsive Columns', () => {
    it('should call useResponsiveColumns with correct config', async () => {
      const { useResponsiveColumns } = await import(
        '@/hooks/use-responsive-columns'
      );

      render(<KnowledgeTable {...defaultProps} />);

      expect(useResponsiveColumns).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ key: 'title' }),
          expect.objectContaining({ key: 'documentType' }),
          expect.objectContaining({ key: 'objective' }),
          expect.objectContaining({ key: 'createdAt' }),
          expect.objectContaining({ key: 'size' }),
        ]),
        {
          mobile: ['title', 'createdAt'],
          tablet: ['title', 'documentType', 'createdAt'],
        },
      );
    });

    it('should use columns returned from hook', async () => {
      const { useResponsiveColumns } = await import(
        '@/hooks/use-responsive-columns'
      );
      vi.mocked(useResponsiveColumns).mockReturnValueOnce([
        { key: 'title', name: 'Title' },
        { key: 'createdAt', name: 'Created' },
      ]);

      render(<KnowledgeTable {...defaultProps} />);

      expect(screen.getByTestId('columns')).toHaveTextContent('2');
    });
  });

  describe('Search Functionality', () => {
    it('should filter by title', async () => {
      const user = userEvent.setup();
      render(<KnowledgeTable {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents...');
      await user.type(searchInput, 'Planning');

      // Wait for debounce to complete
      await waitFor(
        () => {
          expect(screen.getByTestId('rows')).toHaveTextContent('1');
        },
        { timeout: 1000 },
      );

      expect(screen.getByTestId('row-doc-1')).toBeInTheDocument();
      expect(screen.queryByTestId('row-doc-2')).not.toBeInTheDocument();
    });

    it('should filter by content', async () => {
      const user = userEvent.setup();
      render(<KnowledgeTable {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents...');
      await user.type(searchInput, 'transcript');

      await waitFor(
        () => {
          expect(screen.getByTestId('rows')).toHaveTextContent('1');
        },
        { timeout: 1000 },
      );

      expect(screen.getByTestId('row-doc-2')).toBeInTheDocument();
    });

    it('should be case-insensitive', async () => {
      const user = userEvent.setup();
      render(<KnowledgeTable {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents...');
      await user.type(searchInput, 'PLANNING');

      await waitFor(
        () => {
          expect(screen.getByTestId('rows')).toHaveTextContent('1');
        },
        { timeout: 1000 },
      );
    });

    it('should debounce search queries', async () => {
      const user = userEvent.setup();
      render(<KnowledgeTable {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents...');

      // Type multiple characters quickly
      await user.type(searchInput, 'Plan');

      // Should not filter yet (still shows 2)
      expect(screen.getByTestId('rows')).toHaveTextContent('2');

      // Wait for debounce
      await waitFor(
        () => {
          expect(screen.getByTestId('rows')).toHaveTextContent('1');
        },
        { timeout: 1000 },
      );
    });

    it('should show empty state when no results', async () => {
      const user = userEvent.setup();
      render(<KnowledgeTable {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents...');
      await user.type(searchInput, 'nonexistent');

      await waitFor(
        () => {
          expect(
            screen.getByText('No documents match your search'),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it('should clear filters when search is cleared', async () => {
      const user = userEvent.setup();
      render(<KnowledgeTable {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents...');

      // Type and filter
      await user.type(searchInput, 'Planning');

      await waitFor(
        () => {
          expect(screen.getByTestId('rows')).toHaveTextContent('1');
        },
        { timeout: 1000 },
      );

      // Clear search
      await user.clear(searchInput);

      await waitFor(
        () => {
          expect(screen.getByTestId('rows')).toHaveTextContent('2');
        },
        { timeout: 1000 },
      );
    });

    it('should update debounced query correctly', async () => {
      const user = userEvent.setup();
      render(<KnowledgeTable {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents...');

      // Type first query
      await user.type(searchInput, 'Planning');

      await waitFor(
        () => {
          expect(screen.getByTestId('rows')).toHaveTextContent('1');
        },
        { timeout: 1000 },
      );

      // Clear and type new query
      await user.clear(searchInput);
      await user.type(searchInput, 'Transcript');

      await waitFor(
        () => {
          expect(screen.getByTestId('row-doc-2')).toBeInTheDocument();
        },
        { timeout: 1000 },
      );

      expect(screen.getByTestId('rows')).toHaveTextContent('1');
    });

    it('should show search empty state when filtered results are empty', async () => {
      const user = userEvent.setup();
      render(<KnowledgeTable {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search documents...');
      await user.type(searchInput, 'xyz123');

      await waitFor(
        () => {
          expect(
            screen.getByText('No documents match your search'),
          ).toBeInTheDocument();
        },
        { timeout: 1000 },
      );
    });

    it('should handle special characters in search', async () => {
      const user = userEvent.setup();
      const doc = createMockDocument({
        title: 'Test [Document] (2024)',
      });

      render(<KnowledgeTable documents={[doc]} workspaceId="ws-1" />);

      const searchInput = screen.getByPlaceholderText('Search documents...');
      await user.type(searchInput, '[Document]');

      await waitFor(
        () => {
          expect(screen.getByTestId('rows')).toHaveTextContent('1');
        },
        { timeout: 1000 },
      );
    });

    it('should handle search across multiple documents', async () => {
      const user = userEvent.setup();
      const docs = [
        createMockDocument({
          id: '1',
          title: 'Q1 Summary',
          content: 'Summary for Q1',
        }),
        createMockDocument({
          id: '2',
          title: 'Q2 Summary',
          content: 'Summary for Q2',
        }),
        createMockDocument({
          id: '3',
          title: 'Q3 Summary',
          content: 'Summary for Q3',
        }),
      ];

      render(<KnowledgeTable documents={docs} workspaceId="ws-1" />);

      const searchInput = screen.getByPlaceholderText('Search documents...');
      await user.type(searchInput, 'Summary');

      await waitFor(
        () => {
          expect(screen.getByTestId('rows')).toHaveTextContent('3');
        },
        { timeout: 1000 },
      );
    });
  });

  describe('Empty States', () => {
    it('should show empty state when no documents', () => {
      render(<KnowledgeTable documents={[]} workspaceId="ws-1" />);

      expect(screen.getByText('No documents yet')).toBeInTheDocument();
      expect(screen.queryByTestId('data-grid')).not.toBeInTheDocument();
    });

    it('should not render DataGrid when empty', () => {
      render(<KnowledgeTable documents={[]} workspaceId="ws-1" />);

      expect(screen.queryByTestId('data-grid')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null objectiveId', () => {
      const doc = createMockDocument({ objectiveId: null });

      render(<KnowledgeTable documents={[doc]} workspaceId="ws-1" />);

      const cell = screen.getByTestId('cell-doc-1-objective');
      expect(cell.textContent).toBe('Workspace-level');
    });

    it('should handle undefined objectiveId', () => {
      const doc = createMockDocument({ objectiveId: undefined });

      render(<KnowledgeTable documents={[doc]} workspaceId="ws-1" />);

      const cell = screen.getByTestId('cell-doc-1-objective');
      expect(cell.textContent).toBe('Workspace-level');
    });

    it('should handle long titles with truncation', () => {
      const doc = createMockDocument({
        title: 'A'.repeat(200),
      });

      render(<KnowledgeTable documents={[doc]} workspaceId="ws-1" />);

      const cell = screen.getByTestId('cell-doc-1-title');
      expect(cell.querySelector('.truncate')).toBeInTheDocument();
    });

    it('should handle long content with line clamp', () => {
      const doc = createMockDocument({
        content: 'B'.repeat(500),
      });

      render(<KnowledgeTable documents={[doc]} workspaceId="ws-1" />);

      const cell = screen.getByTestId('cell-doc-1-title');
      expect(cell.querySelector('.line-clamp-1')).toBeInTheDocument();
    });

    it('should handle empty content', () => {
      const doc = createMockDocument({ content: '' });

      render(<KnowledgeTable documents={[doc]} workspaceId="ws-1" />);

      const cell = screen.getByTestId('cell-doc-1-size');
      expect(cell.textContent).toBe('0.0 KB');
    });

    it('should handle very large content', () => {
      const doc = createMockDocument({
        content: 'x'.repeat(1024 * 100), // 100 KB
      });

      render(<KnowledgeTable documents={[doc]} workspaceId="ws-1" />);

      const cell = screen.getByTestId('cell-doc-1-size');
      expect(cell.textContent).toBe('100.0 KB');
    });

    it('should handle single document', () => {
      const doc = createMockDocument();

      render(<KnowledgeTable documents={[doc]} workspaceId="ws-1" />);

      expect(screen.getByTestId('rows')).toHaveTextContent('1');
      expect(screen.getByTestId('row-doc-1')).toBeInTheDocument();
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle mixed document types', () => {
      const docs = [
        createMockDocument({ id: '1', documentType: 'summary' }),
        createMockDocument({ id: '2', documentType: 'transcript' }),
        createMockDocument({ id: '3', documentType: 'analysis' }),
      ];

      render(<KnowledgeTable documents={docs} workspaceId="ws-1" />);

      expect(screen.getByTestId('rows')).toHaveTextContent('3');
    });

    it('should handle mixed objective associations', () => {
      const docs = [
        createMockDocument({ id: '1', objectiveId: null }),
        createMockDocument({ id: '2', objectiveId: 'obj-1' }),
        createMockDocument({ id: '3', objectiveId: 'obj-2' }),
      ];

      render(<KnowledgeTable documents={docs} workspaceId="ws-1" />);

      const cell1 = screen.getByTestId('cell-1-objective');
      const cell2 = screen.getByTestId('cell-2-objective');
      const cell3 = screen.getByTestId('cell-3-objective');

      expect(cell1.textContent).toBe('Workspace-level');
      expect(cell2.textContent).toBe('Linked');
      expect(cell3.textContent).toBe('Linked');
    });
  });
});
