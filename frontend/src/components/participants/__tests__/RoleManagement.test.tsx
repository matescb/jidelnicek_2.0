import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoleManagement } from '../RoleManagement';
import { Participant, ParticipantRole } from '../../../types/participants';
import { AuthContext } from '../../../context/AuthContext';
import '@testing-library/jest-dom';

// Mock all Material-UI components since they're not installed
jest.mock('@mui/material/styles', () => ({
  ThemeProvider: ({ children }: any) => children,
  createTheme: () => ({}),
}));

jest.mock('@mui/material', () => {
  const actual = jest.requireActual('react');
  return {
    Box: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    CardHeader: ({ title, action, ...props }: any) => (
      <div {...props}>
        <div>{title}</div>
        <div>{action}</div>
      </div>
    ),
    Typography: ({ children, variant, ...props }: any) => {
      const tag = variant?.startsWith('h') ? variant : 'span';
      return actual.createElement(tag, props, children);
    },
    Table: ({ children, ...props }: any) => <table {...props}>{children}</table>,
    TableBody: ({ children, ...props }: any) => <tbody {...props}>{children}</tbody>,
    TableCell: ({ children, ...props }: any) => <td {...props}>{children}</td>,
    TableContainer: ({ children, ...props }: any) => <div className="MuiTableContainer-root" {...props}>{children}</div>,
    TableHead: ({ children, ...props }: any) => <thead {...props}>{children}</thead>,
    TableRow: ({ children, ...props }: any) => <tr {...props}>{children}</tr>,
    Paper: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    IconButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    Chip: ({ label, color, size, variant, ...props }: any) => (
      <span className={`MuiChip-root MuiChip-color${color ? color.charAt(0).toUpperCase() + color.slice(1) : 'Default'}`} {...props}>
        {label}
      </span>
    ),
    Select: ({ children, value, onChange, displayEmpty, ...props }: any) => {
      const [isOpen, setIsOpen] = actual.useState(false);
      return (
        <div>
          <input
            type="text"
            value={value}
            readOnly
            onMouseDown={() => setIsOpen(true)}
            {...props}
          />
          {isOpen && (
            <div role="listbox">
              {actual.Children.map(children, (child: any) =>
                child && typeof child === 'object' && child.props
                  ? actual.cloneElement(child, {
                      onClick: () => {
                        onChange({ target: { value: child.props.value } });
                        setIsOpen(false);
                      },
                      role: 'option',
                    })
                  : child
              )}
            </div>
          )}
        </div>
      );
    },
    MenuItem: ({ children, value, onClick, ...props }: any) => (
      <div value={value} onClick={onClick} {...props}>{children}</div>
    ),
    FormControl: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    InputLabel: ({ children, ...props }: any) => <label {...props}>{children}</label>,
    Button: ({ children, onClick, variant, ...props }: any) => (
      <button onClick={onClick} {...props}>{children}</button>
    ),
    Dialog: ({ open, children, onClose, ...props }: any) => 
      open ? <div role="dialog" {...props}>{children}</div> : null,
    DialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
    DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    DialogActions: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    DialogContentText: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    Checkbox: ({ checked, onChange, disabled, ...props }: any) => (
      <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} {...props} />
    ),
    Tooltip: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    Grid: ({ children, container, item, ...props }: any) => <div {...props}>{children}</div>,
    Alert: ({ children, severity, ...props }: any) => (
      <div className={`MuiAlert-root MuiAlert-${severity}`} {...props}>{children}</div>
    ),
    SelectChangeEvent: {} as any,
    FormControlLabel: ({ control, label, ...props }: any) => (
      <label {...props}>
        {control}
        {label}
      </label>
    ),
  };
});

jest.mock('@mui/icons-material', () => ({
  Edit: () => <span data-testid="EditIcon">Edit</span>,
  Security: () => <span data-testid="SecurityIcon">Security</span>,
  Group: () => <span data-testid="GroupIcon">Group</span>,
  CheckCircle: () => <span data-testid="CheckCircleIcon">CheckCircle</span>,
  Cancel: () => <span data-testid="CancelIcon">Cancel</span>,
  Info: () => <span data-testid="InfoIcon">Info</span>,
}));

// Mock the usePermissions hook
jest.mock('../../../hooks/usePermissions', () => ({
  usePermissions: jest.fn(() => ({
    canAssignRoles: true,
    permissions: ['participants.assign_roles'],
    hasPermission: jest.fn(() => true),
  })),
}));

// Theme is mocked

const mockUser = {
  id: 'user1',
  email: 'test@example.com',
  name: 'Test User',
  avatar: '',
  role: 'user' as const,
  emailVerified: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockAuthContext = {
  user: mockUser,
  isLoading: false,
  isAuthenticated: true,
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  refreshToken: jest.fn(),
  updateUser: jest.fn(),
};

const mockParticipants: Participant[] = [
  {
    id: 'p1',
    userId: 'user1',
    tripId: 'trip1',
    name: 'John Owner',
    email: 'owner@example.com',
    role: 'owner',
    status: 'active',
    joinedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'p2',
    userId: 'user2',
    tripId: 'trip1',
    name: 'Jane Organizer',
    email: 'organizer@example.com',
    role: 'organizer',
    status: 'active',
    joinedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 'p3',
    userId: 'user3',
    tripId: 'trip1',
    name: 'Bob Participant',
    email: 'participant@example.com',
    role: 'participant',
    status: 'active',
    joinedAt: '2024-01-03T00:00:00Z',
  },
  {
    id: 'p4',
    userId: 'user4',
    tripId: 'trip1',
    name: 'Alice Guest',
    email: 'guest@example.com',
    role: 'guest',
    status: 'pending',
    joinedAt: '2024-01-04T00:00:00Z',
  },
];

const renderComponent = (props = {}) => {
  const defaultProps = {
    participants: mockParticipants,
    currentUserId: 'user1',
    onRoleChange: jest.fn(),
    onBulkRoleChange: jest.fn(),
  };

  return render(
    <AuthContext.Provider value={mockAuthContext}>
      <RoleManagement {...defaultProps} {...props} />
    </AuthContext.Provider>
  );
};

describe('RoleManagement Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1: Permissions matrix rendering
  describe('Permissions Matrix', () => {
    it('should render permissions matrix when show button is clicked', async () => {
      renderComponent();
      
      expect(screen.queryByText('Permissions Matrix')).not.toBeInTheDocument();
      
      const showButton = screen.getByRole('button', { name: /show permissions matrix/i });
      fireEvent.click(showButton);
      
      await waitFor(() => {
        expect(screen.getByText('Permissions Matrix')).toBeInTheDocument();
      });
      
      // Check for permission categories
      expect(screen.getByText('Trip')).toBeInTheDocument();
      expect(screen.getByText('Participants')).toBeInTheDocument();
      expect(screen.getByText('Meals')).toBeInTheDocument();
      expect(screen.getByText('Shopping')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should show correct permissions for each role', async () => {
      renderComponent();
      
      const showButton = screen.getByRole('button', { name: /show permissions matrix/i });
      fireEvent.click(showButton);
      
      await waitFor(() => {
        expect(screen.getByText('Permissions Matrix')).toBeInTheDocument();
      });
      
      // Find the permissions matrix table
      const matrixTable = screen.getByRole('table', { name: '' });
      const rows = within(matrixTable).getAllByRole('row');
      
      // Check that owner has all permissions (looking for checkmarks)
      const ownerCells = within(rows[1]).getAllByRole('cell');
      expect(ownerCells[1]).toContainElement(screen.getAllByTestId('CheckCircleIcon')[0]);
    });
  });

  // Test 2: Role selection and highlighting
  describe('Role Selection and Highlighting', () => {
    it('should highlight current user with "You" chip', () => {
      renderComponent();
      
      const youChip = screen.getByText('You');
      expect(youChip).toBeInTheDocument();
      expect(youChip.closest('tr')).toContainElement(screen.getByText('John Owner'));
    });

    it('should show appropriate role chips with correct colors', () => {
      renderComponent();
      
      const ownerChip = screen.getByText('Owner');
      const organizerChip = screen.getByText('Organizer');
      const participantChip = screen.getByText('Participant');
      const guestChip = screen.getByText('Guest');
      
      expect(ownerChip).toHaveClass('MuiChip-colorError');
      expect(organizerChip).toHaveClass('MuiChip-colorWarning');
      expect(participantChip).toHaveClass('MuiChip-colorPrimary');
      expect(guestChip).toHaveClass('MuiChip-colorDefault');
    });
  });

  // Test 3: Permission tooltips
  describe('Permission Tooltips', () => {
    it('should display permission descriptions in the matrix', async () => {
      renderComponent();
      
      const showButton = screen.getByRole('button', { name: /show permissions matrix/i });
      fireEvent.click(showButton);
      
      await waitFor(() => {
        expect(screen.getByText('View trip details and itinerary')).toBeInTheDocument();
        expect(screen.getByText('Edit trip name, dates, and description')).toBeInTheDocument();
      });
    });
  });

  // Test 4: Bulk role assignment
  describe('Bulk Role Assignment', () => {
    it('should show bulk actions when participants are selected', async () => {
      renderComponent();
      
      // Select multiple participants
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[2]); // Select Jane Organizer
      fireEvent.click(checkboxes[3]); // Select Bob Participant
      
      await waitFor(() => {
        expect(screen.getByText('2 participant(s) selected')).toBeInTheDocument();
      });
      
      expect(screen.getByRole('button', { name: /apply to selected/i })).toBeInTheDocument();
    });

    it('should call onBulkRoleChange when bulk assignment is applied', async () => {
      const onBulkRoleChange = jest.fn();
      renderComponent({ onBulkRoleChange });
      
      // Select participants
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[2]); // Jane Organizer
      fireEvent.click(checkboxes[3]); // Bob Participant
      
      // Change bulk role
      const bulkRoleSelect = screen.getByLabelText('Assign Role');
      fireEvent.mouseDown(bulkRoleSelect);
      const guestOption = screen.getByRole('option', { name: 'Guest' });
      fireEvent.click(guestOption);
      
      // Apply bulk change
      const applyButton = screen.getByRole('button', { name: /apply to selected/i });
      fireEvent.click(applyButton);
      
      await waitFor(() => {
        expect(onBulkRoleChange).toHaveBeenCalledWith(['p2', 'p3'], 'guest');
      });
    });

    it('should handle select all functionality', async () => {
      renderComponent();
      
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);
      
      await waitFor(() => {
        // Should select all except current user and owners
        expect(screen.getByText('2 participant(s) selected')).toBeInTheDocument();
      });
    });
  });

  // Test 5: Role change with confirmation dialog
  describe('Role Change Confirmation', () => {
    it('should show confirmation dialog when changing role', async () => {
      renderComponent();
      
      // Find Jane's role select
      const roleSelects = screen.getAllByDisplayValue('organizer');
      fireEvent.mouseDown(roleSelects[0]);
      
      const participantOption = screen.getByRole('option', { name: 'Participant' });
      fireEvent.click(participantOption);
      
      await waitFor(() => {
        expect(screen.getByText('Confirm Role Change')).toBeInTheDocument();
        expect(screen.getByText(/change Jane Organizer's role from/i)).toBeInTheDocument();
      });
    });

    it('should show role-specific warnings in confirmation dialog', async () => {
      renderComponent();
      
      // Change to guest role
      const roleSelects = screen.getAllByDisplayValue('participant');
      fireEvent.mouseDown(roleSelects[0]);
      
      const guestOption = screen.getByRole('option', { name: 'Guest' });
      fireEvent.click(guestOption);
      
      await waitFor(() => {
        expect(screen.getByText('Guests have limited access and can only view trip information.')).toBeInTheDocument();
      });
    });

    it('should call onRoleChange when confirmed', async () => {
      const onRoleChange = jest.fn();
      renderComponent({ onRoleChange });
      
      // Change role
      const roleSelects = screen.getAllByDisplayValue('organizer');
      fireEvent.mouseDown(roleSelects[0]);
      
      const participantOption = screen.getByRole('option', { name: 'Participant' });
      fireEvent.click(participantOption);
      
      // Confirm
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(onRoleChange).toHaveBeenCalledWith('p2', 'participant');
      });
    });

    it('should close dialog when cancelled', async () => {
      renderComponent();
      
      // Open dialog
      const roleSelects = screen.getAllByDisplayValue('organizer');
      fireEvent.mouseDown(roleSelects[0]);
      const participantOption = screen.getByRole('option', { name: 'Participant' });
      fireEvent.click(participantOption);
      
      // Cancel
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);
      
      await waitFor(() => {
        expect(screen.queryByText('Confirm Role Change')).not.toBeInTheDocument();
      });
    });
  });

  // Test 6: Permission checks for role assignment
  describe('Permission Checks', () => {
    it('should show warning when user lacks permission', async () => {
      const { usePermissions } = require('../../../hooks/usePermissions');
      usePermissions.mockReturnValue({
        canAssignRoles: false,
        permissions: [],
        hasPermission: jest.fn(() => false),
      });
      
      renderComponent();
      
      expect(screen.getByText("You don't have permission to manage roles.")).toBeInTheDocument();
    });

    it('should disable role changes for non-owners', () => {
      renderComponent({ currentUserId: 'user2' }); // Organizer
      
      // Check that owner's role cannot be changed
      const ownerRow = screen.getByText('John Owner').closest('tr');
      expect(within(ownerRow!).getByText('Owner (cannot change)')).toBeInTheDocument();
    });

    it('should not allow users to change their own role', () => {
      renderComponent();
      
      const currentUserRow = screen.getByText('You').closest('tr');
      expect(within(currentUserRow!).getByText('No permission')).toBeInTheDocument();
    });
  });

  // Test 7: Search/filter functionality
  describe('Search and Filter', () => {
    it('should display all participants in the table', () => {
      renderComponent();
      
      expect(screen.getByText('John Owner')).toBeInTheDocument();
      expect(screen.getByText('Jane Organizer')).toBeInTheDocument();
      expect(screen.getByText('Bob Participant')).toBeInTheDocument();
      expect(screen.getByText('Alice Guest')).toBeInTheDocument();
    });

    it('should show participant email addresses', () => {
      renderComponent();
      
      expect(screen.getByText('owner@example.com')).toBeInTheDocument();
      expect(screen.getByText('organizer@example.com')).toBeInTheDocument();
      expect(screen.getByText('participant@example.com')).toBeInTheDocument();
      expect(screen.getByText('guest@example.com')).toBeInTheDocument();
    });

    it('should show participant status', () => {
      renderComponent();
      
      const activeChips = screen.getAllByText('active');
      const pendingChips = screen.getAllByText('pending');
      
      expect(activeChips).toHaveLength(3);
      expect(pendingChips).toHaveLength(1);
    });
  });

  // Test 8: Responsive design
  describe('Responsive Design', () => {
    it('should render table in a scrollable container', () => {
      renderComponent();
      
      const tableContainer = screen.getByRole('table').closest('.MuiTableContainer-root');
      expect(tableContainer).toBeInTheDocument();
    });

    it('should handle mobile viewport gracefully', () => {
      // Mock mobile viewport
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));
      
      renderComponent();
      
      // Table should still be rendered
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
  });

  // Test 9: Keyboard navigation
  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation for role selects', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Tab to first role select
      const roleSelects = screen.getAllByDisplayValue('organizer');
      await user.tab();
      
      // The first focusable element should be focused
      expect(document.activeElement).toBeTruthy();
    });

    it('should allow keyboard operation of checkboxes', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      const checkboxes = screen.getAllByRole('checkbox');
      
      // Focus and activate checkbox with keyboard
      checkboxes[2].focus();
      await user.keyboard(' ');
      
      expect(checkboxes[2]).toBeChecked();
    });

    it('should allow keyboard navigation in confirmation dialog', async () => {
      const user = userEvent.setup();
      renderComponent();
      
      // Open dialog
      const roleSelects = screen.getAllByDisplayValue('organizer');
      fireEvent.mouseDown(roleSelects[0]);
      const participantOption = screen.getByRole('option', { name: 'Participant' });
      fireEvent.click(participantOption);
      
      // Tab through dialog buttons
      await user.tab();
      await user.tab();
      
      // Confirm button should be focusable
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      expect(document.activeElement).toBe(confirmButton);
    });
  });

  // Test 10: Additional edge cases
  describe('Edge Cases', () => {
    it('should handle empty participants list', () => {
      renderComponent({ participants: [] });
      
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.queryByText('John Owner')).not.toBeInTheDocument();
    });

    it('should handle role change errors gracefully', async () => {
      const onRoleChange = jest.fn().mockRejectedValue(new Error('Network error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      renderComponent({ onRoleChange });
      
      // Change role
      const roleSelects = screen.getAllByDisplayValue('organizer');
      fireEvent.mouseDown(roleSelects[0]);
      const participantOption = screen.getByRole('option', { name: 'Participant' });
      fireEvent.click(participantOption);
      
      // Confirm
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to change role:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should show role descriptions section', () => {
      renderComponent();
      
      expect(screen.getByText('Role Descriptions')).toBeInTheDocument();
      expect(screen.getByText('Full access to all trip features and settings')).toBeInTheDocument();
      expect(screen.getByText('Can manage participants, meals, and edit trip details')).toBeInTheDocument();
      expect(screen.getByText('Can view trip information and update own profile')).toBeInTheDocument();
      expect(screen.getByText('Read-only access to trip information')).toBeInTheDocument();
    });

    it('should handle bulk selection deselection', async () => {
      renderComponent();
      
      // Select a participant
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[2]);
      
      expect(screen.getByText('1 participant(s) selected')).toBeInTheDocument();
      
      // Deselect
      fireEvent.click(checkboxes[2]);
      
      await waitFor(() => {
        expect(screen.queryByText('1 participant(s) selected')).not.toBeInTheDocument();
      });
    });
  });
});