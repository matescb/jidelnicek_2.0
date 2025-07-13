import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BaseDataTable, Column } from '../BaseDataTable';

interface TestData {
  id: number;
  name: string;
  age: number;
  email: string;
  active: boolean;
}

const mockData: TestData[] = [
  { id: 1, name: 'John Doe', age: 30, email: 'john@example.com', active: true },
  { id: 2, name: 'Jane Smith', age: 25, email: 'jane@example.com', active: false },
  { id: 3, name: 'Bob Johnson', age: 35, email: 'bob@example.com', active: true },
  { id: 4, name: 'Alice Brown', age: 28, email: 'alice@example.com', active: true },
  { id: 5, name: 'Charlie Davis', age: 32, email: 'charlie@example.com', active: false },
];

const columns: Column<TestData>[] = [
  { key: 'id', header: 'ID', sortable: true },
  { key: 'name', header: 'Name', sortable: true, filterable: true },
  { key: 'age', header: 'Age', sortable: true },
  { key: 'email', header: 'Email', sortable: true, filterable: true },
  { key: 'active', header: 'Active', render: (value) => value ? 'Yes' : 'No' },
];

describe('BaseDataTable', () => {
  it('renders data correctly', () => {
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
      />
    );

    // Check headers
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Age')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Check data
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('35')).toBeInTheDocument();
  });

  it('handles sorting correctly', async () => {
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
      />
    );

    // Click on age header to sort
    const ageHeader = screen.getByText('Age');
    fireEvent.click(ageHeader);

    // Check if data is sorted by age ascending
    const cells = screen.getAllByRole('cell');
    const ageCells = cells.filter((_, index) => index % 5 === 2); // Age is 3rd column
    
    expect(ageCells[0]).toHaveTextContent('25'); // Jane is youngest
    expect(ageCells[1]).toHaveTextContent('28'); // Alice
    expect(ageCells[2]).toHaveTextContent('30'); // John
  });

  it('handles pagination correctly', () => {
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
        pageSize={2}
      />
    );

    // Should only show 2 items
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();

    // Click next page
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    // Should show next 2 items
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
    expect(screen.getByText('Alice Brown')).toBeInTheDocument();
  });

  it('handles row selection correctly', () => {
    const onSelectionChange = vi.fn();
    
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
        selectable
        multiSelect
        onSelectionChange={onSelectionChange}
      />
    );

    // Click on first row checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // First data row checkbox

    expect(onSelectionChange).toHaveBeenCalledWith([mockData[0]]);
  });

  it('handles global search correctly', async () => {
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
        searchable
      />
    );

    const searchInput = screen.getByPlaceholderText('Search...');
    await userEvent.type(searchInput, 'jane');

    // Should only show Jane's row
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
  });

  it('handles column visibility toggle', async () => {
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
      />
    );

    // Click column toggle button
    const toggleButton = screen.getByTitle('Toggle columns');
    fireEvent.click(toggleButton);

    // Uncheck email column
    const emailCheckbox = screen.getByLabelText('Email');
    fireEvent.click(emailCheckbox);

    // Email column should be hidden
    expect(screen.queryByText('Email')).not.toBeInTheDocument();
    expect(screen.queryByText('john@example.com')).not.toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <BaseDataTable
        data={[]}
        columns={columns}
        getRowKey={(item) => item.id}
        loading
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error state', () => {
    const errorMessage = 'Failed to load data';
    
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
  });

  it('shows empty state', () => {
    render(
      <BaseDataTable
        data={[]}
        columns={columns}
        getRowKey={(item) => item.id}
        emptyMessage="No records found"
      />
    );

    expect(screen.getByText('No records found')).toBeInTheDocument();
  });

  it('handles export functionality', () => {
    const onExport = vi.fn();
    
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
        exportable
        onExport={onExport}
      />
    );

    const exportButton = screen.getByTitle('Export all data');
    fireEvent.click(exportButton);

    expect(onExport).toHaveBeenCalledWith(mockData, false);
  });

  it('handles row click', () => {
    const onRowClick = vi.fn();
    
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
        onRowClick={onRowClick}
      />
    );

    // Click on a row
    const firstRow = screen.getByText('John Doe').closest('tr');
    fireEvent.click(firstRow!);

    expect(onRowClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('applies custom row className', () => {
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
        rowClassName={(item) => item.active ? 'active-row' : 'inactive-row'}
      />
    );

    const activeRow = screen.getByText('John Doe').closest('tr');
    const inactiveRow = screen.getByText('Jane Smith').closest('tr');

    expect(activeRow).toHaveClass('active-row');
    expect(inactiveRow).toHaveClass('inactive-row');
  });

  it('handles multi-sort correctly', () => {
    render(
      <BaseDataTable
        data={mockData}
        columns={columns}
        getRowKey={(item) => item.id}
        multiSort
        defaultSort={[
          { key: 'active', direction: 'desc' },
          { key: 'age', direction: 'asc' }
        ]}
      />
    );

    // Should be sorted by active desc, then age asc
    const rows = screen.getAllByRole('row').slice(1); // Skip header row
    
    // Active users should come first, sorted by age
    expect(rows[0]).toHaveTextContent('Alice Brown'); // Active, age 28
    expect(rows[1]).toHaveTextContent('John Doe');    // Active, age 30
    expect(rows[2]).toHaveTextContent('Bob Johnson'); // Active, age 35
  });
});