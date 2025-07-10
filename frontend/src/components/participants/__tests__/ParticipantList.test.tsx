import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParticipantList } from '../ParticipantList';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useTripStore } from '@/store/slices/tripStore';
import { useToast } from '@/hooks/useToast';
import { usePresence } from '@/hooks/usePresence';
import type { TripParticipant } from '@/types';

// Mock dependencies
jest.mock('@/store/slices/tripStore');
jest.mock('@/hooks/useToast');
jest.mock('@/hooks/usePresence');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ tripId: 'test-trip-1' }),
  useNavigate: () => mockNavigate,
}));

const mockNavigate = jest.fn();
const mockShowToast = jest.fn();
const mockRemoveParticipant = jest.fn();
const mockUpdateParticipant = jest.fn();
const mockUpdatePresence = jest.fn();

// Sample test data
const mockParticipants: TripParticipant[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'planner',
    status: 'accepted',
    mealCoefficient: 1,
    snackCoefficient: 1,
    joinedAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'participant',
    status: 'pending',
    mealCoefficient: 0.5,
    snackCoefficient: 0.5,
    joinedAt: new Date('2024-01-02'),
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'participant',
    status: 'declined',
    mealCoefficient: 1,
    snackCoefficient: 0,
    joinedAt: new Date('2024-01-03'),
  },
  {
    id: '4',
    name: 'Alice Brown',
    email: 'alice@example.com',
    role: 'planner',
    status: 'accepted',
    mealCoefficient: 1,
    snackCoefficient: 1,
    joinedAt: new Date('2024-01-04'),
  },
];

const mockTrip = {
  id: 'test-trip-1',
  name: 'Test Trip',
  participants: mockParticipants,
  startDate: '2024-07-01',
  endDate: '2024-07-14',
};

const mockPresenceState = {
  '1': { isOnline: true, lastSeen: new Date(), currentActivity: 'Viewing participants' },
  '2': { isOnline: false, lastSeen: new Date(Date.now() - 1000 * 60 * 5) },
  '3': { isOnline: false, lastSeen: new Date(Date.now() - 1000 * 60 * 60 * 24) },
  '4': { isOnline: true, lastSeen: new Date() },
};

describe('ParticipantList', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock implementations
    (useTripStore as jest.Mock).mockReturnValue({
      trips: [mockTrip],
      loading: false,
      error: null,
      removeParticipant: mockRemoveParticipant,
      updateParticipant: mockUpdateParticipant,
    });
    
    (useToast as jest.Mock).mockReturnValue({
      showToast: mockShowToast,
    });
    
    (usePresence as jest.Mock).mockReturnValue({
      presenceState: mockPresenceState,
      updatePresence: mockUpdatePresence,
    });
    
    // Mock window.confirm
    global.confirm = jest.fn(() => true);
    
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = jest.fn();
    
    // Mock document.createElement for download
    const mockAnchor = {
      click: jest.fn(),
      href: '',
      download: '',
    };
    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return mockAnchor as any;
      }
      return document.createElement(tagName);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      onAddParticipant: jest.fn(),
      onEditParticipant: jest.fn(),
    };

    return render(
      <MemoryRouter initialEntries={['/trips/test-trip-1/participants']}>
        <Routes>
          <Route
            path="/trips/:tripId/participants"
            element={<ParticipantList {...defaultProps} {...props} />}
          />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Rendering', () => {
    it('renders participant list with all participants', () => {
      renderComponent();
      
      expect(screen.getByText('Participants')).toBeInTheDocument();
      mockParticipants.forEach(participant => {
        expect(screen.getByText(participant.name)).toBeInTheDocument();
        expect(screen.getByText(participant.email)).toBeInTheDocument();
      });
    });

    it('renders add participant button', () => {
      const onAddParticipant = jest.fn();
      renderComponent({ onAddParticipant });
      
      const addButton = screen.getByRole('button', { name: /add participant/i });
      expect(addButton).toBeInTheDocument();
      
      fireEvent.click(addButton);
      expect(onAddParticipant).toHaveBeenCalledTimes(1);
    });

    it('displays participant roles correctly', () => {
      renderComponent();
      
      const plannerBadges = screen.getAllByText('planner');
      const participantBadges = screen.getAllByText('participant');
      
      expect(plannerBadges).toHaveLength(2);
      expect(participantBadges).toHaveLength(2);
    });

    it('displays participant status correctly', () => {
      renderComponent();
      
      expect(screen.getAllByText('accepted')).toHaveLength(2);
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('declined')).toBeInTheDocument();
    });

    it('displays meal and snack coefficients', () => {
      renderComponent();
      
      // Check for meal coefficients in table view
      const mealCells = screen.getAllByText('1').filter(el => 
        el.closest('td') && el.closest('td')?.previousElementSibling?.textContent?.includes('accepted')
      );
      expect(mealCells.length).toBeGreaterThan(0);
      
      // Check for snack coefficient 0.5
      expect(screen.getByText('0.5')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters participants by name search', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      await userEvent.type(searchInput, 'John');
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('filters participants by email search', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      await userEvent.type(searchInput, 'jane@');
      
      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
      });
    });

    it('shows all participants when search is cleared', async () => {
      renderComponent();
      
      const searchInput = screen.getByPlaceholderText(/search by name or email/i);
      await userEvent.type(searchInput, 'John');
      
      await waitFor(() => {
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });
      
      await userEvent.clear(searchInput);
      
      await waitFor(() => {
        mockParticipants.forEach(participant => {
          expect(screen.getByText(participant.name)).toBeInTheDocument();
        });
      });
    });
  });

  describe('Filtering', () => {
    it('filters participants by role', async () => {
      renderComponent();
      
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);
      
      const roleSelect = screen.getByLabelText(/role/i);
      await userEvent.selectOptions(roleSelect, 'planner');
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('filters participants by status', async () => {
      renderComponent();
      
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);
      
      const statusSelect = screen.getByLabelText(/status/i);
      await userEvent.selectOptions(statusSelect, 'accepted');
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('shows filter count badge when filters are active', async () => {
      renderComponent();
      
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);
      
      const roleSelect = screen.getByLabelText(/role/i);
      await userEvent.selectOptions(roleSelect, 'planner');
      
      await waitFor(() => {
        const badge = within(filterButton).getByText('1');
        expect(badge).toBeInTheDocument();
      });
    });

    it('combines multiple filters', async () => {
      renderComponent();
      
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);
      
      const roleSelect = screen.getByLabelText(/role/i);
      const statusSelect = screen.getByLabelText(/status/i);
      
      await userEvent.selectOptions(roleSelect, 'planner');
      await userEvent.selectOptions(statusSelect, 'accepted');
      
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    it('sorts participants by name', async () => {
      renderComponent();
      
      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);
      
      await waitFor(() => {
        const names = screen.getAllByText(/^(John Doe|Jane Smith|Bob Johnson|Alice Brown)$/);
        expect(names[0]).toHaveTextContent('Alice Brown');
        expect(names[1]).toHaveTextContent('Bob Johnson');
        expect(names[2]).toHaveTextContent('Jane Smith');
        expect(names[3]).toHaveTextContent('John Doe');
      });
    });

    it('reverses sort direction on second click', async () => {
      renderComponent();
      
      const nameHeader = screen.getByText('Name').closest('th');
      fireEvent.click(nameHeader!);
      
      await waitFor(() => {
        const names = screen.getAllByText(/^(John Doe|Jane Smith|Bob Johnson|Alice Brown)$/);
        expect(names[0]).toHaveTextContent('Alice Brown');
      });
      
      fireEvent.click(nameHeader!);
      
      await waitFor(() => {
        const names = screen.getAllByText(/^(John Doe|Jane Smith|Bob Johnson|Alice Brown)$/);
        expect(names[0]).toHaveTextContent('John Doe');
      });
    });

    it('sorts by email', async () => {
      renderComponent();
      
      const emailHeader = screen.getByText('Email').closest('th');
      fireEvent.click(emailHeader!);
      
      await waitFor(() => {
        const emails = screen.getAllByText(/@example\.com/);
        expect(emails[0]).toHaveTextContent('alice@example.com');
        expect(emails[1]).toHaveTextContent('bob@example.com');
      });
    });

    it('sorts by role', async () => {
      renderComponent();
      
      const roleHeader = screen.getByText('Role').closest('th');
      fireEvent.click(roleHeader!);
      
      await waitFor(() => {
        const firstRole = screen.getAllByText(/participant|planner/)[0];
        expect(firstRole).toHaveTextContent('participant');
      });
    });

    it('sorts by status', async () => {
      renderComponent();
      
      const statusHeader = screen.getByText('Status').closest('th');
      fireEvent.click(statusHeader!);
      
      await waitFor(() => {
        const firstStatus = screen.getAllByText(/accepted|pending|declined/)[0];
        expect(firstStatus).toHaveTextContent('accepted');
      });
    });

    it('sorts by meal coefficient', async () => {
      renderComponent();
      
      const mealHeader = screen.getByText('Meal Coef.').closest('th');
      fireEvent.click(mealHeader!);
      
      await waitFor(() => {
        const cells = screen.getAllByRole('cell');
        const mealCells = cells.filter(cell => 
          cell.textContent === '0.5' || cell.textContent === '1'
        );
        expect(mealCells[0]).toHaveTextContent('0.5');
      });
    });
  });

  describe('Pagination', () => {
    it('shows pagination controls when more than 10 participants', () => {
      const manyParticipants = Array.from({ length: 15 }, (_, i) => ({
        ...mockParticipants[0],
        id: `participant-${i}`,
        name: `Participant ${i + 1}`,
        email: `participant${i + 1}@example.com`,
      }));
      
      (useTripStore as jest.Mock).mockReturnValue({
        trips: [{ ...mockTrip, participants: manyParticipants }],
        loading: false,
        error: null,
        removeParticipant: mockRemoveParticipant,
        updateParticipant: mockUpdateParticipant,
      });
      
      renderComponent();
      
      expect(screen.getByText(/showing.*1.*to.*10/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('navigates to next page', async () => {
      const manyParticipants = Array.from({ length: 15 }, (_, i) => ({
        ...mockParticipants[0],
        id: `participant-${i}`,
        name: `Participant ${i + 1}`,
        email: `participant${i + 1}@example.com`,
      }));
      
      (useTripStore as jest.Mock).mockReturnValue({
        trips: [{ ...mockTrip, participants: manyParticipants }],
        loading: false,
        error: null,
        removeParticipant: mockRemoveParticipant,
        updateParticipant: mockUpdateParticipant,
      });
      
      renderComponent();
      
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      await waitFor(() => {
        expect(screen.getByText(/showing.*11.*to.*15/i)).toBeInTheDocument();
        expect(screen.getByText('Participant 11')).toBeInTheDocument();
      });
    });

    it('changes items per page', async () => {
      const manyParticipants = Array.from({ length: 25 }, (_, i) => ({
        ...mockParticipants[0],
        id: `participant-${i}`,
        name: `Participant ${i + 1}`,
        email: `participant${i + 1}@example.com`,
      }));
      
      (useTripStore as jest.Mock).mockReturnValue({
        trips: [{ ...mockTrip, participants: manyParticipants }],
        loading: false,
        error: null,
        removeParticipant: mockRemoveParticipant,
        updateParticipant: mockUpdateParticipant,
      });
      
      renderComponent();
      
      const perPageSelect = screen.getByDisplayValue('10');
      await userEvent.selectOptions(perPageSelect, '20');
      
      await waitFor(() => {
        expect(screen.getByText(/showing.*1.*to.*20/i)).toBeInTheDocument();
      });
    });

    it('resets to first page when filters change', async () => {
      const manyParticipants = Array.from({ length: 15 }, (_, i) => ({
        ...mockParticipants[0],
        id: `participant-${i}`,
        name: `Participant ${i + 1}`,
        email: `participant${i + 1}@example.com`,
        role: i % 2 === 0 ? 'planner' : 'participant',
      }));
      
      (useTripStore as jest.Mock).mockReturnValue({
        trips: [{ ...mockTrip, participants: manyParticipants }],
        loading: false,
        error: null,
        removeParticipant: mockRemoveParticipant,
        updateParticipant: mockUpdateParticipant,
      });
      
      renderComponent();
      
      // Go to page 2
      const nextButton = screen.getByRole('button', { name: /next/i });
      fireEvent.click(nextButton);
      
      // Apply filter
      const filterButton = screen.getByRole('button', { name: /filters/i });
      fireEvent.click(filterButton);
      
      const roleSelect = screen.getByLabelText(/role/i);
      await userEvent.selectOptions(roleSelect, 'planner');
      
      await waitFor(() => {
        expect(screen.getByText(/showing.*1.*to/i)).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Selection and Actions', () => {
    it('selects individual participants', async () => {
      renderComponent();
      
      const checkboxes = screen.getAllByRole('checkbox');
      const firstParticipantCheckbox = checkboxes[1]; // Skip select all checkbox
      
      fireEvent.click(firstParticipantCheckbox);
      
      await waitFor(() => {
        expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
      });
    });

    it('selects all participants on current page', async () => {
      renderComponent();
      
      const selectAllCheckbox = screen.getAllByRole('checkbox')[0];
      fireEvent.click(selectAllCheckbox);
      
      await waitFor(() => {
        expect(screen.getByText(/4 selected/i)).toBeInTheDocument();
      });
    });

    it('shows bulk actions when participants are selected', async () => {
      renderComponent();
      
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);
      
      await waitFor(() => {
        const bulkActionsButton = screen.getByText(/1 selected/i);
        expect(bulkActionsButton).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText(/1 selected/i));
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /change role/i })).toBeInTheDocument();
      });
    });

    it('deletes selected participants', async () => {
      renderComponent();
      
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);
      
      fireEvent.click(screen.getByText(/1 selected/i));
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith(
          'Are you sure you want to delete 1 participant(s)?'
        );
        expect(mockRemoveParticipant).toHaveBeenCalledWith('test-trip-1', '1');
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Deleted 1 participant(s)',
          type: 'success',
        });
      });
    });

    it('exports selected participants', async () => {
      renderComponent();
      
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);
      
      fireEvent.click(screen.getByText(/1 selected/i));
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Participants exported successfully',
          type: 'success',
        });
      });
    });

    it('changes role for selected participants', async () => {
      renderComponent();
      
      // Select a participant
      const checkbox = screen.getAllByRole('checkbox')[2]; // Select Jane Smith (participant)
      fireEvent.click(checkbox);
      
      fireEvent.click(screen.getByText(/1 selected/i));
      
      const changeRoleButton = screen.getByRole('button', { name: /change role/i });
      fireEvent.click(changeRoleButton);
      
      const setPlannerButton = screen.getByRole('button', { name: /set as planner/i });
      fireEvent.click(setPlannerButton);
      
      await waitFor(() => {
        expect(mockUpdateParticipant).toHaveBeenCalledWith('test-trip-1', '2', { role: 'planner' });
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Updated role for 1 participant(s)',
          type: 'success',
        });
      });
    });
  });

  describe('Add/Edit/Delete Operations', () => {
    it('calls onEditParticipant when edit button is clicked', async () => {
      const onEditParticipant = jest.fn();
      renderComponent({ onEditParticipant });
      
      const editButtons = screen.getAllByTestId('edit-participant');
      fireEvent.click(editButtons[0]);
      
      expect(onEditParticipant).toHaveBeenCalledWith(mockParticipants[0]);
    });

    it('deletes individual participant with confirmation', async () => {
      renderComponent();
      
      const deleteButtons = screen.getAllByTestId('delete-participant');
      fireEvent.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith(
          'Are you sure you want to remove John Doe from this trip?'
        );
        expect(mockRemoveParticipant).toHaveBeenCalledWith('test-trip-1', '1');
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Success',
          description: 'Participant removed successfully',
          type: 'success',
        });
      });
    });

    it('cancels deletion when user declines confirmation', async () => {
      global.confirm = jest.fn(() => false);
      renderComponent();
      
      const deleteButtons = screen.getAllByTestId('delete-participant');
      fireEvent.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalled();
        expect(mockRemoveParticipant).not.toHaveBeenCalled();
      });
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading state', () => {
      (useTripStore as jest.Mock).mockReturnValue({
        trips: [],
        loading: true,
        error: null,
        removeParticipant: mockRemoveParticipant,
        updateParticipant: mockUpdateParticipant,
      });
      
      renderComponent();
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('shows error state', () => {
      const errorMessage = 'Failed to load participants';
      (useTripStore as jest.Mock).mockReturnValue({
        trips: [],
        loading: false,
        error: errorMessage,
        removeParticipant: mockRemoveParticipant,
        updateParticipant: mockUpdateParticipant,
      });
      
      renderComponent();
      
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Error loading participants')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    it('shows empty state when no participants', () => {
      (useTripStore as jest.Mock).mockReturnValue({
        trips: [{ ...mockTrip, participants: [] }],
        loading: false,
        error: null,
        removeParticipant: mockRemoveParticipant,
        updateParticipant: mockUpdateParticipant,
      });
      
      renderComponent();
      
      expect(screen.getByText('No participants yet')).toBeInTheDocument();
      expect(screen.getByText('Add participants to start planning your trip')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add first participant/i })).toBeInTheDocument();
    });

    it('calls onAddParticipant from empty state', async () => {
      const onAddParticipant = jest.fn();
      (useTripStore as jest.Mock).mockReturnValue({
        trips: [{ ...mockTrip, participants: [] }],
        loading: false,
        error: null,
        removeParticipant: mockRemoveParticipant,
        updateParticipant: mockUpdateParticipant,
      });
      
      renderComponent({ onAddParticipant });
      
      const addButton = screen.getByRole('button', { name: /add first participant/i });
      fireEvent.click(addButton);
      
      expect(onAddParticipant).toHaveBeenCalledTimes(1);
    });
  });

  describe('Responsive Behavior', () => {
    it('shows table view on desktop', () => {
      renderComponent();
      
      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();
      const tableContainer = table.closest('.hidden.lg\\:block');
      expect(tableContainer).toBeInTheDocument();
    });

    it('shows card view on mobile', () => {
      renderComponent();
      
      const cardContainer = screen.getByTestId('participant-cards');
      expect(cardContainer).toBeInTheDocument();
      expect(cardContainer).toHaveClass('block', 'lg:hidden');
    });

    it('displays all participant info in card view', () => {
      renderComponent();
      
      const cards = screen.getAllByTestId('participant-card');
      const firstCard = cards[0];
      
      expect(within(firstCard).getByText('John Doe')).toBeInTheDocument();
      expect(within(firstCard).getByText('john@example.com')).toBeInTheDocument();
      expect(within(firstCard).getByText('planner')).toBeInTheDocument();
      expect(within(firstCard).getByText('accepted')).toBeInTheDocument();
      expect(within(firstCard).getByText(/meal.*1/i)).toBeInTheDocument();
      expect(within(firstCard).getByText(/snack.*1/i)).toBeInTheDocument();
    });

    it('displays email with mail icon in card view', () => {
      renderComponent();
      
      const cards = screen.getAllByTestId('participant-card');
      const firstCard = cards[0];
      
      expect(within(firstCard).getByText('john@example.com')).toBeInTheDocument();
    });
  });

  describe('Presence/Status Indicators', () => {
    it('shows online status for online participants', () => {
      renderComponent();
      
      const onlineIndicators = screen.getAllByTestId('status-indicator-online');
      expect(onlineIndicators).toHaveLength(2); // John and Alice are online
    });

    it('shows offline status for offline participants', () => {
      renderComponent();
      
      const offlineIndicators = screen.getAllByTestId('status-indicator-offline');
      expect(offlineIndicators).toHaveLength(2); // Jane and Bob are offline
    });

    it('displays last seen time in tooltip', async () => {
      renderComponent();
      
      const statusIndicator = screen.getAllByTestId('status-indicator-offline')[0];
      fireEvent.mouseOver(statusIndicator);
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByRole('tooltip')).toHaveTextContent(/last seen/i);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('navigates pages with arrow keys', async () => {
      const manyParticipants = Array.from({ length: 15 }, (_, i) => ({
        ...mockParticipants[0],
        id: `participant-${i}`,
        name: `Participant ${i + 1}`,
        email: `participant${i + 1}@example.com`,
      }));
      
      (useTripStore as jest.Mock).mockReturnValue({
        trips: [{ ...mockTrip, participants: manyParticipants }],
        loading: false,
        error: null,
        removeParticipant: mockRemoveParticipant,
        updateParticipant: mockUpdateParticipant,
      });
      
      renderComponent();
      
      // Navigate to page 2
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      
      await waitFor(() => {
        expect(screen.getByText(/showing.*11.*to.*15/i)).toBeInTheDocument();
      });
      
      // Navigate back to page 1
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      
      await waitFor(() => {
        expect(screen.getByText(/showing.*1.*to.*10/i)).toBeInTheDocument();
      });
    });

    it('clears selection with Escape key', async () => {
      renderComponent();
      
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);
      
      expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
      
      fireEvent.keyDown(window, { key: 'Escape' });
      
      await waitFor(() => {
        expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error toast when delete fails', async () => {
      mockRemoveParticipant.mockRejectedValueOnce(new Error('Network error'));
      renderComponent();
      
      const deleteButtons = screen.getAllByTestId('delete-participant');
      fireEvent.click(deleteButtons[0]);
      
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to remove participant',
          type: 'error',
        });
      });
    });

    it('shows error toast when bulk delete fails', async () => {
      mockRemoveParticipant.mockRejectedValueOnce(new Error('Network error'));
      renderComponent();
      
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);
      
      fireEvent.click(screen.getByText(/1 selected/i));
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);
      
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to delete participants',
          type: 'error',
        });
      });
    });

    it('shows error toast when role update fails', async () => {
      mockUpdateParticipant.mockRejectedValueOnce(new Error('Network error'));
      renderComponent();
      
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);
      
      fireEvent.click(screen.getByText(/1 selected/i));
      
      const changeRoleButton = screen.getByRole('button', { name: /change role/i });
      fireEvent.click(changeRoleButton);
      
      const setPlannerButton = screen.getByRole('button', { name: /set as planner/i });
      fireEvent.click(setPlannerButton);
      
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to update roles',
          type: 'error',
        });
      });
    });

    it('shows error toast when export fails', async () => {
      // Mock URL.createObjectURL to throw error
      global.URL.createObjectURL = jest.fn(() => {
        throw new Error('Export failed');
      });
      
      renderComponent();
      
      const checkbox = screen.getAllByRole('checkbox')[1];
      fireEvent.click(checkbox);
      
      fireEvent.click(screen.getByText(/1 selected/i));
      
      const exportButton = screen.getByRole('button', { name: /export/i });
      fireEvent.click(exportButton);
      
      await waitFor(() => {
        expect(mockShowToast).toHaveBeenCalledWith({
          title: 'Error',
          description: 'Failed to export participants',
          type: 'error',
        });
      });
    });
  });
});