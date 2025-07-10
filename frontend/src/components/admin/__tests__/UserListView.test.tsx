import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '../../../test-utils/testUtils';
import userEvent from '@testing-library/user-event';
import { UserListView } from '../UserListView';
import { useAdminStore } from '@/store/slices/adminStore';
import { useToastStore } from '@/store/slices/toastStore';
import { createMockUser } from '../../../test-utils/testUtils';
import { format } from 'date-fns';

// Mock dependencies
jest.mock('@/store/slices/adminStore');
jest.mock('@/store/slices/toastStore');

// Mock UI components
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, defaultValue }: any) => <div data-value={defaultValue}>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: any) => <button data-value={value}>{children}</button>,
  TabsContent: ({ children, value }: any) => <div data-tab={value}>{children}</div>
}));

jest.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className }: any) => <div className={className} data-testid="skeleton" />
}));

const mockUsers = [
  createMockUser({
    id: '1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'admin',
    status: 'active',
    emailVerified: true,
    lastLogin: new Date('2024-01-15T10:30:00').toISOString(),
    tripsCreated: 10,
    recipesAdded: 25
  }),
  createMockUser({
    id: '2',
    email: 'jane.smith@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'user',
    status: 'active',
    emailVerified: false,
    lastLogin: null,
    tripsCreated: 5,
    recipesAdded: 8,
    invitationToken: 'invite-token-123'
  }),
  createMockUser({
    id: '3',
    email: 'bob.wilson@example.com',
    firstName: 'Bob',
    lastName: 'Wilson',
    role: 'user',
    status: 'suspended',
    emailVerified: true,
    lastLogin: new Date('2024-01-10T15:45:00').toISOString(),
    tripsCreated: 0,
    recipesAdded: 0
  })
];

describe('UserListView', () => {
  const user = userEvent.setup();
  const mockAddToast = jest.fn();
  
  const defaultStoreState = {
    users: mockUsers,
    totalUsers: 3,
    currentPage: 1,
    pageSize: 10,
    filters: {},
    sort: { field: 'name', direction: 'asc' },
    selectedUsers: [],
    loading: false,
    error: null,
    fetchUsers: jest.fn(),
    setFilters: jest.fn(),
    setSort: jest.fn(),
    toggleUserSelection: jest.fn(),
    selectAllUsers: jest.fn(),
    setCurrentPage: jest.fn(),
    performBulkAction: jest.fn(),
    exportUsers: jest.fn(),
    suspendUser: jest.fn(),
    activateUser: jest.fn(),
    changeUserRole: jest.fn(),
    resendInvitation: jest.fn(),
    deleteUser: jest.fn(),
    inviteUser: jest.fn(),
    fetchUserActivity: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAdminStore as any).mockReturnValue(defaultStoreState);
    (useToastStore as any).mockReturnValue({ addToast: mockAddToast });
    window.confirm = jest.fn(() => true);
  });

  describe('Rendering and Layout', () => {
    it('renders all main components', () => {
      render(<UserListView />);

      expect(screen.getByText('User Management')).toBeInTheDocument();
      expect(screen.getByText('Manage users, roles, and permissions')).toBeInTheDocument();
      expect(screen.getByText('Invite User')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('displays user statistics cards', () => {
      render(<UserListView />);

      expect(screen.getByText('Total Users')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      
      expect(screen.getByText('Suspended')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      
      expect(screen.getByText('Admins')).toBeInTheDocument();
      
      expect(screen.getByText('Unverified')).toBeInTheDocument();
    });

    it('renders user data in table', () => {
      render(<UserListView />);

      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane.smith@example.com')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });

    it('shows user avatars with initials', () => {
      render(<UserListView />);

      expect(screen.getByText('J')).toBeInTheDocument(); // John
      expect(screen.getByText('B')).toBeInTheDocument(); // Bob
    });

    it('displays role badges with appropriate styling', () => {
      render(<UserListView />);

      const adminBadge = screen.getByText('admin');
      expect(adminBadge).toBeInTheDocument();
      expect(adminBadge.closest('.badge')).toHaveClass('destructive');

      const userBadges = screen.getAllByText('user');
      userBadges.forEach(badge => {
        expect(badge.closest('.badge')).toHaveClass('secondary');
      });
    });

    it('shows status with appropriate icons', () => {
      render(<UserListView />);

      // Active users should have check icon
      const activeRows = screen.getAllByText('active');
      expect(activeRows).toHaveLength(2);

      // Suspended user should have X icon
      expect(screen.getByText('suspended')).toBeInTheDocument();
    });

    it('displays last login information', () => {
      render(<UserListView />);

      expect(screen.getByText(format(new Date('2024-01-15'), 'PP'))).toBeInTheDocument();
      expect(screen.getByText(format(new Date('2024-01-15T10:30:00'), 'p'))).toBeInTheDocument();
      expect(screen.getByText('Never')).toBeInTheDocument(); // Jane never logged in
    });

    it('shows activity metrics', () => {
      render(<UserListView />);

      expect(screen.getByText('10')).toBeInTheDocument(); // John's trips
      expect(screen.getByText('25')).toBeInTheDocument(); // John's recipes
    });

    it('applies custom className', () => {
      const { container } = render(<UserListView className="custom-class" />);
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Filtering and Search', () => {
    it('fetches users on mount', () => {
      const fetchUsers = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchUsers
      });

      render(<UserListView />);
      expect(fetchUsers).toHaveBeenCalled();
    });

    it('handles search with debounce', async () => {
      const setFilters = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<UserListView />);

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      await user.type(searchInput, 'john');

      await waitFor(() => {
        expect(setFilters).toHaveBeenCalledWith({ search: 'john' });
      }, { timeout: 400 });
    });

    it('filters by role', async () => {
      const setFilters = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<UserListView />);

      const roleSelect = screen.getAllByRole('combobox')[0];
      await user.selectOptions(roleSelect, 'admin');

      expect(setFilters).toHaveBeenCalledWith({ role: 'admin' });
    });

    it('filters by status', async () => {
      const setFilters = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<UserListView />);

      const statusSelect = screen.getAllByRole('combobox')[1];
      await user.selectOptions(statusSelect, 'suspended');

      expect(setFilters).toHaveBeenCalledWith({ status: 'suspended' });
    });

    it('filters by email verification', async () => {
      const setFilters = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<UserListView />);

      const verificationSelect = screen.getAllByRole('combobox')[2];
      await user.selectOptions(verificationSelect, 'false');

      expect(setFilters).toHaveBeenCalledWith({ emailVerified: false });
    });
  });

  describe('Sorting', () => {
    it('sorts by name', async () => {
      const setSort = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        setSort
      });

      render(<UserListView />);

      const nameHeader = screen.getByText('User');
      await user.click(nameHeader);

      expect(setSort).toHaveBeenCalledWith({
        field: 'name',
        direction: 'desc'
      });
    });

    it('sorts by email', async () => {
      const setSort = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        sort: { field: 'email', direction: 'asc' },
        setSort
      });

      render(<UserListView />);

      const emailHeader = screen.getByText('Email');
      await user.click(emailHeader);

      expect(setSort).toHaveBeenCalledWith({
        field: 'email',
        direction: 'desc'
      });
    });

    it('sorts by last login', async () => {
      const setSort = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        setSort
      });

      render(<UserListView />);

      const lastLoginHeader = screen.getByText('Last Login');
      await user.click(lastLoginHeader);

      expect(setSort).toHaveBeenCalledWith({
        field: 'lastLogin',
        direction: 'asc'
      });
    });
  });

  describe('User Actions', () => {
    it('opens user activity dialog', async () => {
      const fetchUserActivity = jest.fn().mockResolvedValue({
        trips: [{ id: '1', name: 'Trip 1', startDate: '2024-01-01', endDate: '2024-01-07' }],
        recipes: [{ id: '1', name: 'Recipe 1', createdAt: '2024-01-10' }],
        lastActions: [{ type: 'login', description: 'User logged in', timestamp: '2024-01-15T10:30:00' }]
      });

      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchUserActivity
      });

      render(<UserListView />);

      // Open dropdown for first user
      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const viewActivityOption = screen.getByText('View Activity');
      await user.click(viewActivityOption);

      await waitFor(() => {
        expect(fetchUserActivity).toHaveBeenCalledWith('1');
        expect(screen.getByText('User Activity')).toBeInTheDocument();
      });
    });

    it('suspends active user', async () => {
      const suspendUser = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        suspendUser
      });

      render(<UserListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const suspendOption = screen.getByText('Suspend User');
      await user.click(suspendOption);

      await waitFor(() => {
        expect(suspendUser).toHaveBeenCalledWith('1');
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'User suspended'
        });
      });
    });

    it('activates suspended user', async () => {
      const activateUser = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        activateUser
      });

      render(<UserListView />);

      // Bob is suspended
      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[2]);

      const activateOption = screen.getByText('Activate User');
      await user.click(activateOption);

      await waitFor(() => {
        expect(activateUser).toHaveBeenCalledWith('3');
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'User activated'
        });
      });
    });

    it('changes user role to admin', async () => {
      const changeUserRole = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        changeUserRole
      });

      render(<UserListView />);

      // Jane is a regular user
      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[1]);

      const makeAdminOption = screen.getByText('Make Admin');
      await user.click(makeAdminOption);

      await waitFor(() => {
        expect(changeUserRole).toHaveBeenCalledWith('2', 'admin');
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'User promoted to admin'
        });
      });
    });

    it('removes admin role', async () => {
      const changeUserRole = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        changeUserRole
      });

      render(<UserListView />);

      // John is an admin
      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const removeAdminOption = screen.getByText('Remove Admin');
      await user.click(removeAdminOption);

      await waitFor(() => {
        expect(changeUserRole).toHaveBeenCalledWith('1', 'user');
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'User role changed'
        });
      });
    });

    it('resends invitation', async () => {
      const resendInvitation = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        resendInvitation
      });

      render(<UserListView />);

      // Jane has invitation token
      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[1]);

      const resendOption = screen.getByText('Resend Invitation');
      await user.click(resendOption);

      await waitFor(() => {
        expect(resendInvitation).toHaveBeenCalledWith('2');
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Invitation resent'
        });
      });
    });

    it('deletes user with confirmation', async () => {
      const deleteUser = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        deleteUser
      });

      render(<UserListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const deleteOption = screen.getByText('Delete User');
      await user.click(deleteOption);

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this user?');

      await waitFor(() => {
        expect(deleteUser).toHaveBeenCalledWith('1');
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'User deleted'
        });
      });
    });

    it('cancels deletion when user declines', async () => {
      window.confirm = jest.fn(() => false);
      const deleteUser = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        deleteUser
      });

      render(<UserListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const deleteOption = screen.getByText('Delete User');
      await user.click(deleteOption);

      expect(deleteUser).not.toHaveBeenCalled();
    });
  });

  describe('User Selection', () => {
    it('toggles individual user selection', async () => {
      const toggleUserSelection = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        toggleUserSelection
      });

      render(<UserListView />);

      const checkboxes = screen.getAllByRole('checkbox');
      await user.click(checkboxes[1]); // First user checkbox

      expect(toggleUserSelection).toHaveBeenCalledWith('1');
    });

    it('selects all users', async () => {
      const selectAllUsers = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        selectAllUsers
      });

      render(<UserListView />);

      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      await user.click(selectAllCheckbox);

      expect(selectAllUsers).toHaveBeenCalledWith(true);
    });

    it('shows bulk action controls when users selected', () => {
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        selectedUsers: ['1', '2']
      });

      render(<UserListView />);

      expect(screen.getByText('Bulk Actions (2)')).toBeInTheDocument();
      expect(screen.getByText('Clear Selection')).toBeInTheDocument();
    });

    it('clears selection', async () => {
      const selectAllUsers = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        selectedUsers: ['1', '2'],
        selectAllUsers
      });

      render(<UserListView />);

      const clearButton = screen.getByText('Clear Selection');
      await user.click(clearButton);

      expect(selectAllUsers).toHaveBeenCalledWith(false);
    });
  });

  describe('Bulk Actions', () => {
    it('opens bulk action dialog', async () => {
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        selectedUsers: ['1', '2']
      });

      render(<UserListView />);

      const bulkActionsButton = screen.getByText('Bulk Actions (2)');
      await user.click(bulkActionsButton);

      expect(screen.getByText('Apply this action to 2 selected users')).toBeInTheDocument();
    });

    it('performs bulk activation', async () => {
      const performBulkAction = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        selectedUsers: ['2', '3'],
        performBulkAction
      });

      render(<UserListView />);

      const bulkActionsButton = screen.getByText('Bulk Actions (2)');
      await user.click(bulkActionsButton);

      const actionSelect = within(screen.getByTestId('dialog')).getByRole('combobox');
      await user.selectOptions(actionSelect, 'activate');

      const applyButton = screen.getByText('Apply Action');
      await user.click(applyButton);

      await waitFor(() => {
        expect(performBulkAction).toHaveBeenCalledWith('activate', ['2', '3']);
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Bulk action completed',
          message: 'Action performed on 2 users'
        });
      });
    });

    it('shows destructive styling for delete action', async () => {
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        selectedUsers: ['1', '2']
      });

      render(<UserListView />);

      const bulkActionsButton = screen.getByText('Bulk Actions (2)');
      await user.click(bulkActionsButton);

      const actionSelect = within(screen.getByTestId('dialog')).getByRole('combobox');
      await user.selectOptions(actionSelect, 'delete');

      const applyButton = screen.getByText('Apply Action');
      expect(applyButton).toHaveClass('destructive');
    });
  });

  describe('User Invitation', () => {
    it('opens invite user dialog', async () => {
      render(<UserListView />);

      const inviteButton = screen.getByText('Invite User');
      await user.click(inviteButton);

      expect(screen.getByText('Invite New User')).toBeInTheDocument();
      expect(screen.getByText('Send an invitation to a new user to join the platform.')).toBeInTheDocument();
    });

    it('sends invitation', async () => {
      const inviteUser = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        inviteUser
      });

      render(<UserListView />);

      const inviteButton = screen.getByText('Invite User');
      await user.click(inviteButton);

      const emailInput = screen.getByPlaceholderText('user@example.com');
      await user.type(emailInput, 'newuser@example.com');

      const roleSelect = within(screen.getByTestId('dialog')).getAllByRole('combobox')[0];
      await user.selectOptions(roleSelect, 'admin');

      const sendButton = screen.getByText('Send Invitation');
      await user.click(sendButton);

      await waitFor(() => {
        expect(inviteUser).toHaveBeenCalledWith('newuser@example.com', 'admin');
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Invitation sent',
          message: 'Invitation sent to newuser@example.com'
        });
      });
    });

    it('disables send button without email', () => {
      render(<UserListView />);

      const inviteButton = screen.getByText('Invite User');
      fireEvent.click(inviteButton);

      const sendButton = screen.getByText('Send Invitation');
      expect(sendButton).toBeDisabled();
    });
  });

  describe('Export Functionality', () => {
    it('exports all users', async () => {
      const exportUsers = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        exportUsers
      });

      render(<UserListView />);

      const exportButton = screen.getByText('Export');
      await user.click(exportButton);

      await waitFor(() => {
        expect(exportUsers).toHaveBeenCalledWith(undefined);
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Export started'
        });
      });
    });

    it('exports selected users', async () => {
      const exportUsers = jest.fn().mockResolvedValue(undefined);
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        selectedUsers: ['1', '2'],
        exportUsers
      });

      render(<UserListView />);

      const exportButton = screen.getByText('Export');
      await user.click(exportButton);

      await waitFor(() => {
        expect(exportUsers).toHaveBeenCalledWith(['1', '2']);
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'success',
          title: 'Export started'
        });
      });
    });
  });

  describe('Pagination', () => {
    it('shows pagination controls', () => {
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        totalUsers: 25,
        pageSize: 10,
        currentPage: 1
      });

      render(<UserListView />);

      expect(screen.getByText('Showing 1 to 10 of 25 users')).toBeInTheDocument();
      expect(screen.getByLabelText('Previous page')).toBeDisabled();
      expect(screen.getByLabelText('Next page')).not.toBeDisabled();
    });

    it('navigates to next page', async () => {
      const setCurrentPage = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        totalUsers: 25,
        pageSize: 10,
        currentPage: 1,
        setCurrentPage
      });

      render(<UserListView />);

      const nextButton = screen.getByLabelText('Next page');
      await user.click(nextButton);

      expect(setCurrentPage).toHaveBeenCalledWith(2);
    });

    it('navigates to specific page', async () => {
      const setCurrentPage = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        totalUsers: 50,
        pageSize: 10,
        currentPage: 3,
        setCurrentPage
      });

      render(<UserListView />);

      const page2Button = screen.getByText('2');
      await user.click(page2Button);

      expect(setCurrentPage).toHaveBeenCalledWith(2);
    });

    it('hides pagination for single page', () => {
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        totalUsers: 5,
        pageSize: 10
      });

      render(<UserListView />);

      expect(screen.queryByText('Showing 1 to 5 of 5 users')).not.toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading spinner in table', () => {
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        loading: true,
        users: []
      });

      render(<UserListView />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('shows empty state', () => {
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        users: []
      });

      render(<UserListView />);

      expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    it('refreshes user list', async () => {
      const fetchUsers = jest.fn();
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchUsers
      });

      render(<UserListView />);

      const refreshButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-refresh-ccw')
      );
      await user.click(refreshButton!);

      expect(fetchUsers).toHaveBeenCalledTimes(2); // Once on mount, once on refresh
    });

    it('shows loading animation on refresh button', () => {
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        loading: true
      });

      render(<UserListView />);

      const refreshButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('.lucide-refresh-ccw')
      );
      expect(refreshButton?.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles action errors gracefully', async () => {
      const suspendUser = jest.fn().mockRejectedValue(new Error('Network error'));
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        suspendUser
      });

      render(<UserListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const suspendOption = screen.getByText('Suspend User');
      await user.click(suspendOption);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Action failed',
          message: 'Network error'
        });
      });
    });

    it('handles bulk action errors', async () => {
      const performBulkAction = jest.fn().mockRejectedValue(new Error('Bulk operation failed'));
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        selectedUsers: ['1', '2'],
        performBulkAction
      });

      render(<UserListView />);

      const bulkActionsButton = screen.getByText('Bulk Actions (2)');
      await user.click(bulkActionsButton);

      const actionSelect = within(screen.getByTestId('dialog')).getByRole('combobox');
      await user.selectOptions(actionSelect, 'activate');

      const applyButton = screen.getByText('Apply Action');
      await user.click(applyButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Bulk action failed',
          message: 'Bulk operation failed'
        });
      });
    });

    it('handles export errors', async () => {
      const exportUsers = jest.fn().mockRejectedValue(new Error('Export failed'));
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        exportUsers
      });

      render(<UserListView />);

      const exportButton = screen.getByText('Export');
      await user.click(exportButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Export failed'
        });
      });
    });

    it('handles invitation errors', async () => {
      const inviteUser = jest.fn().mockRejectedValue(new Error('Email already exists'));
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        inviteUser
      });

      render(<UserListView />);

      const inviteButton = screen.getByText('Invite User');
      await user.click(inviteButton);

      const emailInput = screen.getByPlaceholderText('user@example.com');
      await user.type(emailInput, 'existing@example.com');

      const sendButton = screen.getByText('Send Invitation');
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith({
          type: 'error',
          title: 'Failed to send invitation',
          message: 'Email already exists'
        });
      });
    });
  });

  describe('User Activity Dialog', () => {
    it('shows loading state while fetching activity', async () => {
      const fetchUserActivity = jest.fn(() => new Promise(() => {})); // Never resolves
      
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchUserActivity
      });

      render(<UserListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const viewActivityOption = screen.getByText('View Activity');
      await user.click(viewActivityOption);

      await waitFor(() => {
        expect(screen.getAllByTestId('skeleton')).toHaveLength(3);
      });
    });

    it('displays user activity data', async () => {
      const mockActivity = {
        trips: [
          { id: '1', name: 'Summer Trip', startDate: '2024-07-01', endDate: '2024-07-07' }
        ],
        recipes: [
          { id: '1', name: 'Pasta Recipe', createdAt: '2024-01-10T10:00:00' }
        ],
        lastActions: [
          { type: 'trip.create', description: 'Created trip "Summer Trip"', timestamp: '2024-01-15T10:30:00' }
        ]
      };

      const fetchUserActivity = jest.fn().mockResolvedValue(mockActivity);
      
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchUserActivity
      });

      render(<UserListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const viewActivityOption = screen.getByText('View Activity');
      await user.click(viewActivityOption);

      await waitFor(() => {
        expect(screen.getByText('Summer Trip')).toBeInTheDocument();
        expect(screen.getByText('Pasta Recipe')).toBeInTheDocument();
        expect(screen.getByText('trip.create')).toBeInTheDocument();
      });
    });

    it('shows empty states in activity tabs', async () => {
      const mockActivity = {
        trips: [],
        recipes: [],
        lastActions: []
      };

      const fetchUserActivity = jest.fn().mockResolvedValue(mockActivity);
      
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchUserActivity
      });

      render(<UserListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      await user.click(moreButtons[0]);

      const viewActivityOption = screen.getByText('View Activity');
      await user.click(viewActivityOption);

      await waitFor(() => {
        expect(screen.getByText('No trips created')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<UserListView />);

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('User Management');
    });

    it('has accessible form controls', () => {
      render(<UserListView />);

      const searchInput = screen.getByPlaceholderText('Search by name or email...');
      expect(searchInput).toHaveAttribute('type', 'text');

      const selects = screen.getAllByRole('combobox');
      expect(selects).toHaveLength(3); // Role, Status, Verification
    });

    it('provides proper table structure', () => {
      render(<UserListView />);

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      const headers = within(table).getAllByRole('columnheader');
      expect(headers.length).toBeGreaterThan(0);
    });

    it('has keyboard navigable dropdown menus', async () => {
      render(<UserListView />);

      const moreButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('.lucide-more-vertical')
      );
      
      moreButtons[0].focus();
      expect(document.activeElement).toBe(moreButtons[0]);

      // Open dropdown with Enter
      await user.keyboard('{Enter}');
      
      expect(screen.getByText('View Activity')).toBeInTheDocument();
    });

    it('announces dynamic content changes', async () => {
      const { rerender } = render(<UserListView />);

      // Change user count
      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        users: [...mockUsers, createMockUser({ id: '4', email: 'new@example.com' })],
        totalUsers: 4
      });

      rerender(<UserListView />);

      // Stats should update
      expect(screen.getByText('4')).toBeInTheDocument(); // Total users
    });
  });

  describe('Edge Cases', () => {
    it('handles users without names gracefully', () => {
      const usersWithoutNames = [
        createMockUser({
          id: '1',
          email: 'noname@example.com',
          firstName: '',
          lastName: ''
        })
      ];

      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        users: usersWithoutNames
      });

      render(<UserListView />);

      expect(screen.getByText('noname')).toBeInTheDocument(); // Email prefix
      expect(screen.getByText('N')).toBeInTheDocument(); // Avatar initial
    });

    it('handles very long email addresses', () => {
      const userWithLongEmail = [
        createMockUser({
          id: '1',
          email: 'very.long.email.address.that.might.overflow@example-with-long-domain.com'
        })
      ];

      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        users: userWithLongEmail
      });

      render(<UserListView />);

      expect(screen.getByText('very.long.email.address.that.might.overflow@example-with-long-domain.com')).toBeInTheDocument();
    });

    it('handles users with no activity', () => {
      const inactiveUsers = [
        createMockUser({
          id: '1',
          tripsCreated: 0,
          recipesAdded: 0
        })
      ];

      (useAdminStore as any).mockReturnValue({
        ...defaultStoreState,
        users: inactiveUsers
      });

      render(<UserListView />);

      const activityCells = screen.getAllByText('0');
      expect(activityCells.length).toBeGreaterThanOrEqual(2);
    });
  });
});