import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '../../../test-utils/testUtils';
import userEvent from '@testing-library/user-event';
import { BaseDataTable, Column } from '../BaseDataTable';

interface TestData {
  id: number;
  name: string;
  age: number;
  email: string;
  active: boolean;
  category: string;
  salary: number;
  joinDate: string;
}

const generateMockData = (count: number): TestData[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    age: 20 + (i % 40),
    email: `person${i + 1}@example.com`,
    active: i % 3 !== 0,
    category: ['Engineering', 'Sales', 'Marketing'][i % 3],
    salary: 50000 + (i * 5000),
    joinDate: new Date(2020 + (i % 4), i % 12, 1).toISOString()
  }));
};

const mockData = generateMockData(25);

const columns: Column<TestData>[] = [
  { key: 'id', header: 'ID', sortable: true, width: '60px' },
  { key: 'name', header: 'Name', sortable: true, filterable: true },
  { key: 'age', header: 'Age', sortable: true },
  { key: 'email', header: 'Email', sortable: true, filterable: true },
  { key: 'active', header: 'Status', render: (value) => value ? 'Active' : 'Inactive' },
  { key: 'category', header: 'Category', sortable: true, filterable: true },
  { 
    key: 'salary', 
    header: 'Salary', 
    sortable: true,
    render: (value) => `$${value.toLocaleString()}`
  },
  {
    key: 'joinDate',
    header: 'Join Date',
    sortable: true,
    render: (value) => new Date(value).toLocaleDateString()
  }
];

describe('BaseDataTable - Comprehensive Tests', () => {
  const user = userEvent.setup();

  describe('Rendering and Basic Functionality', () => {
    it('renders all data and columns correctly', () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
        />
      );

      // Check headers
      columns.forEach(col => {
        expect(screen.getByText(col.header)).toBeInTheDocument();
      });

      // Check first few rows of data
      expect(screen.getByText('Person 1')).toBeInTheDocument();
      expect(screen.getByText('person1@example.com')).toBeInTheDocument();
      expect(screen.getByText('$50,000')).toBeInTheDocument();
    });

    it('handles empty data gracefully', () => {
      render(
        <BaseDataTable
          data={[]}
          columns={columns}
          getRowKey={(item) => item.id}
          emptyMessage="No employees found"
        />
      );

      expect(screen.getByText('No employees found')).toBeInTheDocument();
    });

    it('shows custom empty icon', () => {
      const CustomEmptyIcon = () => <div data-testid="custom-empty-icon">Empty!</div>;
      
      render(
        <BaseDataTable
          data={[]}
          columns={columns}
          getRowKey={(item) => item.id}
          emptyIcon={<CustomEmptyIcon />}
        />
      );

      expect(screen.getByTestId('custom-empty-icon')).toBeInTheDocument();
    });

    it('applies custom className and styles', () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          className="custom-table-class"
          striped={false}
          hoverable={false}
          compact={true}
        />
      );

      const container = screen.getByRole('table').closest('.custom-table-class');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Sorting Functionality', () => {
    it('sorts data by clicking column headers', async () => {
      render(
        <BaseDataTable
          data={mockData.slice(0, 5)}
          columns={columns}
          getRowKey={(item) => item.id}
        />
      );

      // Click age header to sort ascending
      const ageHeader = screen.getByText('Age');
      await user.click(ageHeader);

      const cells = screen.getAllByRole('cell');
      const ageCells = cells.filter((_, index) => index % columns.length === 2);
      const ages = ageCells.map(cell => parseInt(cell.textContent || '0'));
      
      // Check ascending order
      expect(ages).toEqual([...ages].sort((a, b) => a - b));

      // Click again for descending
      await user.click(ageHeader);
      const descCells = screen.getAllByRole('cell');
      const descAgeCells = descCells.filter((_, index) => index % columns.length === 2);
      const descAges = descAgeCells.map(cell => parseInt(cell.textContent || '0'));
      
      expect(descAges).toEqual([...descAges].sort((a, b) => b - a));
    });

    it('handles multi-sort correctly', async () => {
      render(
        <BaseDataTable
          data={mockData.slice(0, 10)}
          columns={columns}
          getRowKey={(item) => item.id}
          multiSort={true}
        />
      );

      // First sort by category
      await user.click(screen.getByText('Category'));
      
      // Then sort by age within category
      await user.click(screen.getByText('Age'));

      // Verify sort indicators show correct order
      const categoryHeader = screen.getByText('Category').parentElement;
      const ageHeader = screen.getByText('Age').parentElement;
      
      expect(categoryHeader).toHaveTextContent('1'); // First sort
      expect(ageHeader).toHaveTextContent('2'); // Second sort
    });

    it('respects non-sortable columns', async () => {
      const columnsWithNonSortable = columns.map(col => ({
        ...col,
        sortable: col.key !== 'active' ? col.sortable : false
      }));

      render(
        <BaseDataTable
          data={mockData}
          columns={columnsWithNonSortable}
          getRowKey={(item) => item.id}
        />
      );

      const statusHeader = screen.getByText('Status');
      const initialOrder = screen.getAllByRole('cell')
        .filter((_, i) => i % columns.length === 4)
        .map(cell => cell.textContent);

      await user.click(statusHeader);

      const afterClickOrder = screen.getAllByRole('cell')
        .filter((_, i) => i % columns.length === 4)
        .map(cell => cell.textContent);

      expect(initialOrder).toEqual(afterClickOrder);
    });
  });

  describe('Filtering and Search', () => {
    it('filters data based on global search', async () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          searchable={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'Engineering');

      await waitFor(() => {
        const engineeringCells = screen.getAllByText('Engineering');
        expect(engineeringCells.length).toBeGreaterThan(0);
        expect(screen.queryByText('Sales')).not.toBeInTheDocument();
      });
    });

    it('uses custom search placeholder', () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          searchable={true}
          searchPlaceholder="Find employees..."
        />
      );

      expect(screen.getByPlaceholderText('Find employees...')).toBeInTheDocument();
    });

    it('handles controlled global filter', async () => {
      const onGlobalFilterChange = vi.fn();
      const { rerender } = render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          searchable={true}
          globalFilter=""
          onGlobalFilterChange={onGlobalFilterChange}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      await user.type(searchInput, 'test');

      expect(onGlobalFilterChange).toHaveBeenCalledWith('test');

      // Simulate external filter change
      rerender(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          searchable={true}
          globalFilter="Marketing"
          onGlobalFilterChange={onGlobalFilterChange}
        />
      );

      expect(searchInput).toHaveValue('Marketing');
    });

    it('respects filterable column property', async () => {
      const testData = [
        { id: 1, name: 'John Doe', age: 30, email: 'john@test.com', active: true, category: 'A', salary: 1000, joinDate: '' },
        { id: 2, name: 'Jane Smith', age: 25, email: 'jane@test.com', active: false, category: 'B', salary: 2000, joinDate: '' }
      ];

      const columnsWithFilterable: Column<TestData>[] = [
        { key: 'name', header: 'Name', filterable: true },
        { key: 'age', header: 'Age', filterable: false },
        { key: 'email', header: 'Email', filterable: true }
      ];

      render(
        <BaseDataTable
          data={testData}
          columns={columnsWithFilterable}
          getRowKey={(item) => item.id}
          searchable={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      
      // Search for age value (non-filterable)
      await user.type(searchInput, '30');
      await waitFor(() => {
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });

      // Clear and search for name (filterable)
      await user.clear(searchInput);
      await user.type(searchInput, 'John');
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
    });
  });

  describe('Pagination', () => {
    it('paginates data correctly', async () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          pageSize={5}
        />
      );

      // First page should show items 1-5
      expect(screen.getByText('Person 1')).toBeInTheDocument();
      expect(screen.getByText('Person 5')).toBeInTheDocument();
      expect(screen.queryByText('Person 6')).not.toBeInTheDocument();

      // Go to next page
      await user.click(screen.getByText('Next'));

      expect(screen.queryByText('Person 1')).not.toBeInTheDocument();
      expect(screen.getByText('Person 6')).toBeInTheDocument();
      expect(screen.getByText('Person 10')).toBeInTheDocument();
    });

    it('handles page size changes', async () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          pageSize={10}
          pageSizeOptions={[5, 10, 20]}
        />
      );

      const pageSizeSelect = screen.getByDisplayValue('10 per page');
      
      // Change to 5 per page
      await user.selectOptions(pageSizeSelect, '5');
      
      // Should only show 5 items
      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(6); // 5 data rows + 1 header row
    });

    it('disables pagination buttons appropriately', () => {
      render(
        <BaseDataTable
          data={mockData.slice(0, 10)}
          columns={columns}
          getRowKey={(item) => item.id}
          pageSize={5}
        />
      );

      // On first page
      expect(screen.getByText('First')).toBeDisabled();
      expect(screen.getByText('Previous')).toBeDisabled();
      expect(screen.getByText('Next')).not.toBeDisabled();
      expect(screen.getByText('Last')).not.toBeDisabled();

      // Go to last page
      fireEvent.click(screen.getByText('Last'));

      expect(screen.getByText('First')).not.toBeDisabled();
      expect(screen.getByText('Previous')).not.toBeDisabled();
      expect(screen.getByText('Next')).toBeDisabled();
      expect(screen.getByText('Last')).toBeDisabled();
    });

    it('shows correct pagination info', () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          pageSize={10}
        />
      );

      expect(screen.getByText(/Showing 1 to 10 of 25 entries/)).toBeInTheDocument();
    });
  });

  describe('Selection', () => {
    it('handles single row selection', async () => {
      const onSelectionChange = vi.fn();
      
      render(
        <BaseDataTable
          data={mockData.slice(0, 5)}
          columns={columns}
          getRowKey={(item) => item.id}
          selectable={true}
          multiSelect={false}
          onSelectionChange={onSelectionChange}
        />
      );

      const firstRowRadio = screen.getAllByRole('radio')[0];
      await user.click(firstRowRadio);

      expect(onSelectionChange).toHaveBeenCalledWith([mockData[0]]);

      // Click another row - should replace selection
      const secondRowRadio = screen.getAllByRole('radio')[1];
      await user.click(secondRowRadio);

      expect(onSelectionChange).toHaveBeenLastCalledWith([mockData[1]]);
    });

    it('handles multi-row selection', async () => {
      const onSelectionChange = vi.fn();
      
      render(
        <BaseDataTable
          data={mockData.slice(0, 5)}
          columns={columns}
          getRowKey={(item) => item.id}
          selectable={true}
          multiSelect={true}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkboxes = screen.getAllByRole('checkbox');
      
      // Select first row
      await user.click(checkboxes[1]);
      expect(onSelectionChange).toHaveBeenCalledWith([mockData[0]]);

      // Select second row
      await user.click(checkboxes[2]);
      expect(onSelectionChange).toHaveBeenCalledWith([mockData[0], mockData[1]]);
    });

    it('handles select all functionality', async () => {
      const onSelectionChange = vi.fn();
      
      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columns}
          getRowKey={(item) => item.id}
          selectable={true}
          multiSelect={true}
          onSelectionChange={onSelectionChange}
        />
      );

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);

      expect(onSelectionChange).toHaveBeenCalledWith(mockData.slice(0, 3));

      // Click again to deselect all
      await user.click(selectAllCheckbox);
      expect(onSelectionChange).toHaveBeenCalledWith([]);
    });

    it('maintains selection state across pages', async () => {
      const { rerender } = render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          selectable={true}
          multiSelect={true}
          selectedRows={[mockData[0], mockData[10]]}
          pageSize={5}
        />
      );

      // First item on page 1 should be selected
      const firstPageCheckboxes = screen.getAllByRole('checkbox');
      expect(firstPageCheckboxes[1]).toBeChecked();

      // Go to page 3
      await user.click(screen.getByText('Next'));
      await user.click(screen.getByText('Next'));

      // Item 10 should be selected
      const thirdPageCheckboxes = screen.getAllByRole('checkbox');
      expect(thirdPageCheckboxes[1]).toBeChecked();
    });
  });

  describe('Column Visibility', () => {
    it('toggles column visibility', async () => {
      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columns}
          getRowKey={(item) => item.id}
        />
      );

      // Click column toggle button
      const toggleButton = screen.getByTitle('Toggle columns');
      await user.click(toggleButton);

      // Uncheck Email column
      const emailCheckbox = screen.getByLabelText('Email');
      await user.click(emailCheckbox);

      // Email column should be hidden
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
      expect(screen.queryByText('person1@example.com')).not.toBeInTheDocument();

      // Re-enable column
      await user.click(emailCheckbox);
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('respects initial column visibility', () => {
      const columnsWithHidden = columns.map(col => ({
        ...col,
        visible: col.key !== 'salary'
      }));

      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columnsWithHidden}
          getRowKey={(item) => item.id}
        />
      );

      expect(screen.queryByText('Salary')).not.toBeInTheDocument();
      expect(screen.queryByText('$50,000')).not.toBeInTheDocument();
    });

    it('closes column dropdown when clicking outside', async () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
        />
      );

      const toggleButton = screen.getByTitle('Toggle columns');
      await user.click(toggleButton);

      expect(screen.getByText('Visible Columns')).toBeInTheDocument();

      // Click outside
      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Visible Columns')).not.toBeInTheDocument();
      });
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and document.createElement
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
        if (tagName === 'a') {
          return mockAnchor as any;
        }
        return document.createElement(tagName);
      });
    });

    it('exports all data as CSV by default', async () => {
      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columns}
          getRowKey={(item) => item.id}
          exportable={true}
          exportFilename="test-export"
        />
      );

      const exportButton = screen.getByTitle('Export all data');
      await user.click(exportButton);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      const anchor = document.createElement('a') as any;
      expect(anchor.download).toContain('test-export');
      expect(anchor.download).toContain('.csv');
    });

    it('exports selected rows only', async () => {
      const onExport = vi.fn();
      
      render(
        <BaseDataTable
          data={mockData.slice(0, 5)}
          columns={columns}
          getRowKey={(item) => item.id}
          exportable={true}
          selectable={true}
          multiSelect={true}
          selectedRows={[mockData[0], mockData[2]]}
          onExport={onExport}
        />
      );

      const exportSelectedButton = screen.getByText(/Export 2 selected/);
      await user.click(exportSelectedButton);

      expect(onExport).toHaveBeenCalledWith([mockData[0], mockData[2]], true);
    });

    it('uses custom export handler', async () => {
      const onExport = vi.fn();
      
      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columns}
          getRowKey={(item) => item.id}
          exportable={true}
          onExport={onExport}
        />
      );

      const exportButton = screen.getByTitle('Export all data');
      await user.click(exportButton);

      expect(onExport).toHaveBeenCalledWith(mockData.slice(0, 3), false);
    });

    it('hides export button when exportable is false', () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          exportable={false}
        />
      );

      expect(screen.queryByTitle('Export all data')).not.toBeInTheDocument();
    });
  });

  describe('Row Interactions', () => {
    it('handles row click events', async () => {
      const onRowClick = vi.fn();
      
      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columns}
          getRowKey={(item) => item.id}
          onRowClick={onRowClick}
        />
      );

      const firstRow = screen.getByText('Person 1').closest('tr');
      await user.click(firstRow!);

      expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
    });

    it('prevents row click when clicking on selection checkbox', async () => {
      const onRowClick = vi.fn();
      const onSelectionChange = vi.fn();
      
      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columns}
          getRowKey={(item) => item.id}
          selectable={true}
          onRowClick={onRowClick}
          onSelectionChange={onSelectionChange}
        />
      );

      const checkbox = screen.getAllByRole('checkbox')[1];
      await user.click(checkbox);

      expect(onSelectionChange).toHaveBeenCalled();
      expect(onRowClick).not.toHaveBeenCalled();
    });

    it('applies custom row className', () => {
      render(
        <BaseDataTable
          data={mockData.slice(0, 5)}
          columns={columns}
          getRowKey={(item) => item.id}
          rowClassName={(item) => item.active ? 'active-row' : 'inactive-row'}
        />
      );

      const rows = screen.getAllByRole('row').slice(1); // Skip header
      rows.forEach((row, index) => {
        if (mockData[index].active) {
          expect(row).toHaveClass('active-row');
        } else {
          expect(row).toHaveClass('inactive-row');
        }
      });
    });

    it('applies striped rows correctly', () => {
      render(
        <BaseDataTable
          data={mockData.slice(0, 4)}
          columns={columns}
          getRowKey={(item) => item.id}
          striped={true}
        />
      );

      const rows = screen.getAllByRole('row').slice(1); // Skip header
      expect(rows[0]).toHaveClass('bg-gray-50');
      expect(rows[1]).toHaveClass('bg-white');
      expect(rows[2]).toHaveClass('bg-gray-50');
      expect(rows[3]).toHaveClass('bg-white');
    });
  });

  describe('Responsive Behavior', () => {
    it('shows mobile view on small screens', () => {
      // Mock small screen
      window.matchMedia = vi.fn().mockImplementation(query => ({
        matches: query.includes('max-width: 768px'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));

      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columns}
          getRowKey={(item) => item.id}
        />
      );

      // Mobile cards should be visible
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      // Instead, data is rendered as cards
      expect(screen.getByText('Person 1')).toBeInTheDocument();
    });

    it('handles sticky columns', () => {
      const columnsWithSticky: Column<TestData>[] = [
        { ...columns[0], sticky: true },
        ...columns.slice(1)
      ];

      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columnsWithSticky}
          getRowKey={(item) => item.id}
        />
      );

      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveClass('sticky');
    });

    it('handles maxHeight and scrolling', () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          maxHeight="200px"
        />
      );

      const scrollContainer = screen.getByRole('table').parentElement;
      expect(scrollContainer).toHaveStyle({ maxHeight: '200px' });
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading spinner', () => {
      render(
        <BaseDataTable
          data={[]}
          columns={columns}
          getRowKey={(item) => item.id}
          loading={true}
        />
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows error message with details', () => {
      const errorMessage = 'Failed to fetch data: Network error';
      
      render(
        <BaseDataTable
          data={[]}
          columns={columns}
          getRowKey={(item) => item.id}
          error={errorMessage}
        />
      );

      expect(screen.getByText('Error loading data')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('prioritizes error state over loading', () => {
      render(
        <BaseDataTable
          data={[]}
          columns={columns}
          getRowKey={(item) => item.id}
          loading={true}
          error="Error occurred"
        />
      );

      expect(screen.getByText('Error loading data')).toBeInTheDocument();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Advanced Features', () => {
    it('handles complex accessor functions', () => {
      const complexColumns: Column<TestData>[] = [
        {
          key: 'fullInfo',
          header: 'Full Info',
          accessor: (item) => `${item.name} (${item.age} years)`,
          sortable: true
        },
        {
          key: 'status',
          header: 'Employment Status',
          accessor: (item) => item.active && item.salary > 70000 ? 'Senior' : 'Junior'
        }
      ];

      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={complexColumns}
          getRowKey={(item) => item.id}
        />
      );

      expect(screen.getByText('Person 1 (20 years)')).toBeInTheDocument();
      expect(screen.getByText('Junior')).toBeInTheDocument();
    });

    it('handles default sort configuration', () => {
      render(
        <BaseDataTable
          data={mockData.slice(0, 5)}
          columns={columns}
          getRowKey={(item) => item.id}
          defaultSort={[
            { key: 'age', direction: 'desc' },
            { key: 'name', direction: 'asc' }
          ]}
          multiSort={true}
        />
      );

      // Check that data is sorted by age descending
      const cells = screen.getAllByRole('cell');
      const ageCells = cells.filter((_, index) => index % columns.length === 2);
      const ages = ageCells.map(cell => parseInt(cell.textContent || '0'));
      
      expect(ages).toEqual([...ages].sort((a, b) => b - a));
    });

    it('handles virtualization props', () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          virtualized={true}
          rowHeight={50}
        />
      );

      // Virtualization would be implemented by a separate component
      // Here we just verify the props are passed correctly
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('handles column width specifications', () => {
      const columnsWithWidths: Column<TestData>[] = columns.map((col, i) => ({
        ...col,
        width: i === 0 ? '50px' : i === 1 ? '200px' : undefined
      }));

      render(
        <BaseDataTable
          data={mockData.slice(0, 3)}
          columns={columnsWithWidths}
          getRowKey={(item) => item.id}
        />
      );

      const headers = screen.getAllByRole('columnheader');
      expect(headers[0]).toHaveStyle({ width: '50px' });
      expect(headers[1]).toHaveStyle({ width: '200px' });
    });
  });

  describe('Edge Cases', () => {
    it('handles null and undefined values gracefully', () => {
      const dataWithNulls = [
        { id: 1, name: null, age: 30, email: undefined, active: true, category: '', salary: 0, joinDate: '' },
        { id: 2, name: 'Jane', age: null, email: 'jane@test.com', active: false, category: null, salary: null, joinDate: null }
      ];

      render(
        <BaseDataTable
          data={dataWithNulls as any}
          columns={columns}
          getRowKey={(item) => item.id}
        />
      );

      // Should render without crashing
      expect(screen.getByText('Jane')).toBeInTheDocument();
      expect(screen.getByText('$0')).toBeInTheDocument();
    });

    it('handles very long text content', () => {
      const longTextData = [{
        id: 1,
        name: 'A'.repeat(100),
        age: 25,
        email: 'very-long-email-address-that-might-overflow@example-domain-with-long-name.com',
        active: true,
        category: 'Category',
        salary: 50000,
        joinDate: new Date().toISOString()
      }];

      render(
        <BaseDataTable
          data={longTextData}
          columns={columns}
          getRowKey={(item) => item.id}
        />
      );

      const longName = screen.getByText('A'.repeat(100));
      expect(longName).toBeInTheDocument();
      expect(longName.parentElement).toHaveClass('whitespace-nowrap');
    });

    it('handles rapid filter changes', async () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={columns}
          getRowKey={(item) => item.id}
          searchable={true}
        />
      );

      const searchInput = screen.getByPlaceholderText('Search...');
      
      // Type rapidly
      await user.type(searchInput, 'Person');
      await user.clear(searchInput);
      await user.type(searchInput, 'Engineering');
      await user.clear(searchInput);
      await user.type(searchInput, '123');

      // Should handle all changes without errors
      expect(searchInput).toHaveValue('123');
    });

    it('handles empty column configuration', () => {
      render(
        <BaseDataTable
          data={mockData}
          columns={[]}
          getRowKey={(item) => item.id}
        />
      );

      // Should show empty message when no columns
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });
});