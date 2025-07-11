import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdaptiveTable } from '../AdaptiveTable';

// Mock useMediaQuery hook
jest.mock('@/hooks/useMediaQuery', () => ({
  useMediaQuery: jest.fn((query: string) => {
    if (query === '(max-width: 768px)') return false; // Not mobile by default
    if (query === '(max-width: 1024px)') return false; // Not tablet by default
    return false;
  }),
}));

const mockData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
];

const mockColumns = [
  { key: 'name', header: 'Name', priority: 'high' as const },
  { key: 'email', header: 'Email', priority: 'medium' as const },
  { key: 'role', header: 'Role', priority: 'low' as const },
];

describe('AdaptiveTable', () => {
  beforeEach(() => {
    // Reset media query mock
    const { useMediaQuery } = require('@/hooks/useMediaQuery');
    useMediaQuery.mockImplementation((query: string) => {
      if (query === '(max-width: 768px)') return false;
      if (query === '(max-width: 1024px)') return false;
      return false;
    });
  });

  it('renders table on desktop', () => {
    render(<AdaptiveTable data={mockData} columns={mockColumns} />);
    
    // Check table structure
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    
    // Check data
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('renders cards on mobile', () => {
    const { useMediaQuery } = require('@/hooks/useMediaQuery');
    useMediaQuery.mockImplementation((query: string) => {
      if (query === '(max-width: 768px)') return true; // Mobile
      return false;
    });

    const { container } = render(
      <AdaptiveTable data={mockData} columns={mockColumns} mobileVariant="cards" />
    );
    
    // Should render cards instead of table
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const cards = container.querySelectorAll('.mb-4');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('hides low priority columns on tablet', () => {
    const { useMediaQuery } = require('@/hooks/useMediaQuery');
    useMediaQuery.mockImplementation((query: string) => {
      if (query === '(max-width: 768px)') return false;
      if (query === '(max-width: 1024px)') return true; // Tablet
      return false;
    });

    render(<AdaptiveTable data={mockData} columns={mockColumns} />);
    
    // Low priority columns should be hidden
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.queryByText('Role')).not.toBeInTheDocument();
  });

  it('handles row click events', () => {
    const handleClick = jest.fn();
    render(
      <AdaptiveTable 
        data={mockData} 
        columns={mockColumns} 
        onRowClick={handleClick}
      />
    );
    
    // Click on a row
    const firstRow = screen.getByText('John Doe').closest('tr');
    fireEvent.click(firstRow!);
    
    expect(handleClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('renders custom cell content', () => {
    const customColumns = [
      ...mockColumns,
      {
        key: 'actions',
        header: 'Actions',
        cell: (item: any) => <button>Edit {item.name}</button>,
        priority: 'high' as const,
      },
    ];

    render(<AdaptiveTable data={mockData} columns={customColumns} />);
    
    expect(screen.getByText('Edit John Doe')).toBeInTheDocument();
    expect(screen.getByText('Edit Jane Smith')).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(
      <AdaptiveTable 
        data={[]} 
        columns={mockColumns} 
        emptyMessage="No users found"
      />
    );
    
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    const { container } = render(
      <AdaptiveTable 
        data={mockData} 
        columns={mockColumns} 
        loading={true}
      />
    );
    
    const loadingElements = container.querySelectorAll('.animate-pulse');
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('handles nested object paths in columns', () => {
    const nestedData = [
      { id: 1, user: { name: 'John', details: { email: 'john@example.com' } } },
    ];
    
    const nestedColumns = [
      { key: 'user.name', header: 'Name', priority: 'high' as const },
      { key: 'user.details.email', header: 'Email', priority: 'high' as const },
    ];

    render(<AdaptiveTable data={nestedData} columns={nestedColumns} />);
    
    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });
});