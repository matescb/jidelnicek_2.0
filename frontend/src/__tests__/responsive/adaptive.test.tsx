import { vi } from 'vitest';
/**
 * Tests for adaptive layout components
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Container,
  ResponsiveTable,
  AdaptiveDialog,
  ResponsiveForm,
} from '../../components/layout/Adaptive';
import { mockWindowResize, viewports, mockResizeObserver } from './utils';

describe('Container', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResizeObserver();
  });

  it('should apply responsive max-width', () => {
    render(
      <Container data-testid="container">
        <div>Content</div>
      </Container>
    );

    const container = screen.getByTestId('container');
    expect(container).toHaveClass('container');
    expect(container).toHaveClass('mx-auto');
    expect(container).toHaveClass('px-4');
  });

  it('should handle different breakpoints', () => {
    // Mobile
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);
    const { rerender } = render(
      <Container data-testid="container">
        <div>Content</div>
      </Container>
    );

    let container = screen.getByTestId('container');
    expect(container).toHaveStyle({ maxWidth: '100%' });

    // Tablet
    mockWindowResize(viewports.tablet.width, viewports.tablet.height);
    rerender(
      <Container data-testid="container">
        <div>Content</div>
      </Container>
    );

    container = screen.getByTestId('container');
    expect(container).toHaveClass('md:max-w-3xl');

    // Desktop
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);
    rerender(
      <Container data-testid="container">
        <div>Content</div>
      </Container>
    );

    container = screen.getByTestId('container');
    expect(container).toHaveClass('lg:max-w-5xl');
    expect(container).toHaveClass('xl:max-w-7xl');
  });

  it('should apply fluid width', () => {
    render(
      <Container data-testid="container" fluid>
        <div>Content</div>
      </Container>
    );

    const container = screen.getByTestId('container');
    expect(container).toHaveClass('max-w-full');
    expect(container).not.toHaveClass('container');
  });

  it('should apply custom padding', () => {
    render(
      <Container data-testid="container" padding={{ base: '2', md: '4', lg: '8' }}>
        <div>Content</div>
      </Container>
    );

    const container = screen.getByTestId('container');
    expect(container).toHaveClass('px-2');
    expect(container).toHaveClass('md:px-4');
    expect(container).toHaveClass('lg:px-8');
  });

  it('should center content when specified', () => {
    render(
      <Container data-testid="container" center>
        <div>Content</div>
      </Container>
    );

    const container = screen.getByTestId('container');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('items-center');
    expect(container).toHaveClass('justify-center');
  });
});

describe('ResponsiveTable', () => {
  const mockData = [
    { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
    { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User' },
  ];

  const mockColumns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
  ];

  it('should render as table on desktop', () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);

    render(
      <ResponsiveTable
        data={mockData}
        columns={mockColumns}
        keyField="id"
      />
    );

    // Should render table
    expect(screen.getByRole('table')).toBeInTheDocument();

    // Check headers
    mockColumns.forEach((col) => {
      expect(screen.getByText(col.label)).toBeInTheDocument();
    });

    // Check data
    mockData.forEach((row) => {
      expect(screen.getByText(row.name)).toBeInTheDocument();
      expect(screen.getByText(row.email)).toBeInTheDocument();
      expect(screen.getByText(row.role)).toBeInTheDocument();
    });
  });

  it('should render as cards on mobile', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    render(
      <ResponsiveTable
        data={mockData}
        columns={mockColumns}
        keyField="id"
      />
    );

    // Should not render table
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    // Should render cards
    const cards = screen.getAllByTestId('table-card');
    expect(cards).toHaveLength(mockData.length);

    // Check card content
    mockData.forEach((row, index) => {
      const card = cards[index];
      expect(card).toHaveTextContent(row.name);
      expect(card).toHaveTextContent(row.email);
      expect(card).toHaveTextContent(row.role);
    });
  });

  it('should handle custom breakpoint', () => {
    mockWindowResize(viewports.tablet.width, viewports.tablet.height);

    render(
      <ResponsiveTable
        data={mockData}
        columns={mockColumns}
        keyField="id"
        breakpoint="lg"
      />
    );

    // Should render as cards on tablet with lg breakpoint
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('table-card')).toHaveLength(mockData.length);
  });

  it('should apply custom card renderer', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    const customCardRenderer = (row: any) => (
      <div data-testid="custom-card">
        <h3>{row.name}</h3>
        <p>{row.role}</p>
      </div>
    );

    render(
      <ResponsiveTable
        data={mockData}
        columns={mockColumns}
        keyField="id"
        cardRenderer={customCardRenderer}
      />
    );

    const customCards = screen.getAllByTestId('custom-card');
    expect(customCards).toHaveLength(mockData.length);
    expect(customCards[0]).toHaveTextContent('John Doe');
    expect(customCards[0]).toHaveTextContent('Admin');
  });

  it('should handle sorting', () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);

    const handleSort = vi.fn();
    render(
      <ResponsiveTable
        data={mockData}
        columns={mockColumns.map((col) => ({ ...col, sortable: true }))}
        keyField="id"
        onSort={handleSort}
      />
    );

    const nameHeader = screen.getByText('Name');
    userEvent.click(nameHeader);

    expect(handleSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('should handle row selection', () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);

    const handleSelect = vi.fn();
    render(
      <ResponsiveTable
        data={mockData}
        columns={mockColumns}
        keyField="id"
        selectable
        onSelectionChange={handleSelect}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    userEvent.click(checkboxes[1]); // First data row

    expect(handleSelect).toHaveBeenCalledWith([1]);
  });

  it('should show empty state', () => {
    render(
      <ResponsiveTable
        data={[]}
        columns={mockColumns}
        keyField="id"
        emptyMessage="No data available"
      />
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });
});

describe('AdaptiveDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render as modal on desktop', () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);

    render(
      <AdaptiveDialog
        isOpen={true}
        onClose={() => {}}
        title="Desktop Dialog"
      >
        <div data-testid="content">Dialog Content</div>
      </AdaptiveDialog>
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Desktop Dialog')).toBeInTheDocument();
    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should render as bottom sheet on mobile', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    render(
      <AdaptiveDialog
        isOpen={true}
        onClose={() => {}}
        title="Mobile Dialog"
      >
        <div data-testid="content">Dialog Content</div>
      </AdaptiveDialog>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('bottom-sheet');
    expect(screen.getByTestId('drag-indicator')).toBeInTheDocument();
  });

  it('should handle size variations', () => {
    mockWindowResize(viewports.desktop.width, viewports.desktop.height);

    const { rerender } = render(
      <AdaptiveDialog isOpen={true} onClose={() => {}} size="sm">
        <div>Content</div>
      </AdaptiveDialog>
    );

    let dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('max-w-sm');

    rerender(
      <AdaptiveDialog isOpen={true} onClose={() => {}} size="lg">
        <div>Content</div>
      </AdaptiveDialog>
    );

    dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('max-w-lg');
  });

  it('should handle fullscreen on mobile', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    render(
      <AdaptiveDialog
        isOpen={true}
        onClose={() => {}}
        fullscreenOnMobile
      >
        <div>Content</div>
      </AdaptiveDialog>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('fullscreen');
    expect(dialog).toHaveStyle({
      height: '100vh',
      width: '100vw',
    });
  });

  it('should handle close actions', () => {
    const handleClose = vi.fn();
    const handleConfirm = vi.fn();

    render(
      <AdaptiveDialog
        isOpen={true}
        onClose={handleClose}
        onConfirm={handleConfirm}
        confirmText="Save"
        cancelText="Cancel"
      >
        <div>Content</div>
      </AdaptiveDialog>
    );

    const cancelButton = screen.getByText('Cancel');
    const confirmButton = screen.getByText('Save');

    userEvent.click(cancelButton);
    expect(handleClose).toHaveBeenCalled();

    userEvent.click(confirmButton);
    expect(handleConfirm).toHaveBeenCalled();
  });
});

describe('ResponsiveForm', () => {
  const mockFields = [
    { name: 'firstName', label: 'First Name', type: 'text', required: true },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'message', label: 'Message', type: 'textarea', rows: 4 },
  ];

  it('should render with responsive columns', () => {
    render(
      <ResponsiveForm
        fields={mockFields}
        onSubmit={() => {}}
        columns={{ base: 1, md: 2, lg: 3 }}
      />
    );

    const form = screen.getByRole('form');
    expect(form).toHaveClass('grid');
    expect(form).toHaveClass('grid-cols-1');
    expect(form).toHaveClass('md:grid-cols-2');
    expect(form).toHaveClass('lg:grid-cols-3');
  });

  it('should adjust layout on mobile', () => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);

    render(
      <ResponsiveForm
        fields={mockFields}
        onSubmit={() => {}}
      />
    );

    const form = screen.getByRole('form');
    expect(form).toHaveClass('grid-cols-1');

    // All fields should be stacked
    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input.parentElement).toHaveClass('col-span-1');
    });
  });

  it('should handle field spans', () => {
    const fieldsWithSpans = [
      ...mockFields.slice(0, 4),
      { ...mockFields[4], span: { base: 1, md: 2, lg: 3 } },
    ];

    render(
      <ResponsiveForm
        fields={fieldsWithSpans}
        onSubmit={() => {}}
        columns={{ base: 1, md: 2, lg: 3 }}
      />
    );

    const messageField = screen.getByLabelText('Message').parentElement!;
    expect(messageField).toHaveClass('col-span-1');
    expect(messageField).toHaveClass('md:col-span-2');
    expect(messageField).toHaveClass('lg:col-span-3');
  });

  it('should handle form submission', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();

    render(
      <ResponsiveForm
        fields={mockFields}
        onSubmit={handleSubmit}
      />
    );

    // Fill required fields
    await user.type(screen.getByLabelText('First Name'), 'John');
    await user.type(screen.getByLabelText('Last Name'), 'Doe');
    await user.type(screen.getByLabelText('Email'), 'john@example.com');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '',
        message: '',
      });
    });
  });

  it('should show validation errors', async () => {
    const user = userEvent.setup();

    render(
      <ResponsiveForm
        fields={mockFields}
        onSubmit={() => {}}
      />
    );

    // Try to submit without filling required fields
    const submitButton = screen.getByRole('button', { name: /submit/i });
    await user.click(submitButton);

    // Should show error messages
    expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });

  it('should handle custom field components', () => {
    const customFields = [
      {
        name: 'custom',
        label: 'Custom Field',
        component: () => <div data-testid="custom-field">Custom Component</div>,
      },
    ];

    render(
      <ResponsiveForm
        fields={customFields}
        onSubmit={() => {}}
      />
    );

    expect(screen.getByTestId('custom-field')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <ResponsiveForm
        fields={mockFields}
        onSubmit={() => {}}
        loading
      />
    );

    const submitButton = screen.getByRole('button', { name: /submit/i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });
});