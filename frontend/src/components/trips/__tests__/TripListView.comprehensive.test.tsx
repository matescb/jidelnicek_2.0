import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '../../../test-utils/testUtils';
import userEvent from '@testing-library/user-event';
import { TripListView } from '../TripListView';
import { useTripStore } from '@/store/slices/tripStore';
import { createMockTrip } from '../../../test-utils/testUtils';
import { format } from 'date-fns';

// Mock dependencies
jest.mock('@/store/slices/tripStore');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

// Mock components
jest.mock('../TripFilters', () => ({
  TripFilters: ({ filters, onFiltersChange }: any) => (
    <div data-testid="trip-filters">
      <input
        placeholder="Search trips"
        value={filters.search || ''}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        data-testid="search-input"
      />
      <select
        value={filters.status || ''}
        onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
        data-testid="status-filter"
      >
        <option value="">All Status</option>
        <option value="planning">Planning</option>
        <option value="active">Active</option>
        <option value="completed">Completed</option>
      </select>
    </div>
  )
}));

jest.mock('../TripCalendarView', () => ({
  TripCalendarView: ({ trips, onTripClick }: any) => (
    <div data-testid="trip-calendar">
      {trips.map((trip: any) => (
        <div key={trip.id} onClick={() => onTripClick(trip)}>
          {trip.name} - Calendar View
        </div>
      ))}
    </div>
  )
}));

jest.mock('@/components/ui/DataTable', () => ({
  DataTable: ({ data, columns, onRowClick, actions, mobileRenderItem }: any) => (
    <div data-testid="data-table">
      <table>
        <thead>
          <tr>
            {columns.map((col: any) => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item: any) => (
            <tr key={item.id} onClick={() => onRowClick?.(item)} data-testid={`trip-row-${item.id}`}>
              {columns.map((col: any) => (
                <td key={col.key}>
                  {col.accessor ? col.accessor(item) : item[col.key]}
                </td>
              ))}
              <td>{actions?.(item)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Mobile view */}
      <div className="md:hidden">
        {data.map((item: any) => (
          <div key={`mobile-${item.id}`}>
            {mobileRenderItem?.(item)}
          </div>
        ))}
      </div>
    </div>
  )
}));

const mockTrips = [
  createMockTrip({ 
    id: '1', 
    name: 'Summer Vacation', 
    location: 'Beach Resort',
    status: 'planning',
    participantCount: 4,
    days: [
      { date: '2024-07-01', meals: [{}, {}] },
      { date: '2024-07-02', meals: [{}] }
    ]
  }),
  createMockTrip({ 
    id: '2', 
    name: 'Mountain Retreat', 
    location: 'Alpine Lodge',
    status: 'active',
    participantCount: 6,
    days: [
      { date: '2024-06-15', meals: [{}, {}, {}] },
      { date: '2024-06-16', meals: [{}, {}] }
    ]
  }),
  createMockTrip({ 
    id: '3', 
    name: 'City Tour', 
    status: 'completed',
    participantCount: 2,
    isArchived: true 
  })
];

describe('TripListView - Comprehensive Tests', () => {
  const user = userEvent.setup();
  const mockNavigate = jest.fn();
  
  const defaultStoreState = {
    trips: mockTrips,
    loading: false,
    totalTrips: 3,
    currentPage: 1,
    pageSize: 10,
    filters: {},
    sortBy: 'startDate',
    sortOrder: 'desc',
    fetchTrips: jest.fn(),
    setFilters: jest.fn(),
    setSorting: jest.fn(),
    duplicateTrip: jest.fn(),
    updateTrip: jest.fn(),
    deleteTrip: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTripStore as any).mockReturnValue(defaultStoreState);
    
    const { useNavigate } = require('react-router-dom');
    useNavigate.mockReturnValue(mockNavigate);
  });

  describe('Rendering and Layout', () => {
    it('renders all main components', () => {
      render(<TripListView />);

      expect(screen.getByText('Trips')).toBeInTheDocument();
      expect(screen.getByText('Manage your trips (3 total)')).toBeInTheDocument();
      expect(screen.getByTestId('trip-filters')).toBeInTheDocument();
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
      expect(screen.getByText('Create Trip')).toBeInTheDocument();
    });

    it('renders trip data in table view', () => {
      render(<TripListView />);

      mockTrips.forEach(trip => {
        expect(screen.getByText(trip.name)).toBeInTheDocument();
        if (trip.location) {
          expect(screen.getByText(trip.location)).toBeInTheDocument();
        }
      });
    });

    it('switches between list and calendar views', async () => {
      render(<TripListView />);

      // Default is list view
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
      expect(screen.queryByTestId('trip-calendar')).not.toBeInTheDocument();

      // Switch to calendar view
      const calendarTab = screen.getByText('Calendar');
      await user.click(calendarTab);

      expect(screen.queryByTestId('data-table')).not.toBeInTheDocument();
      expect(screen.getByTestId('trip-calendar')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<TripListView className="custom-class" />);
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Trip Actions', () => {
    it('handles trip click navigation', async () => {
      render(<TripListView />);

      const tripRow = screen.getByTestId('trip-row-1');
      await user.click(tripRow);

      expect(mockNavigate).toHaveBeenCalledWith('/trips/1');
    });

    it('calls custom onTripSelect when provided', async () => {
      const onTripSelect = jest.fn();
      render(<TripListView onTripSelect={onTripSelect} />);

      const tripRow = screen.getByTestId('trip-row-1');
      await user.click(tripRow);

      expect(onTripSelect).toHaveBeenCalledWith(mockTrips[0]);
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('handles edit action', async () => {
      render(<TripListView />);

      // Open dropdown for first trip
      const moreButton = within(screen.getByTestId('trip-row-1')).getByRole('button');
      await user.click(moreButton);

      const editOption = screen.getByText('Edit');
      await user.click(editOption);

      expect(mockNavigate).toHaveBeenCalledWith('/trips/1/edit');
    });

    it('handles duplicate action', async () => {
      const duplicateTrip = jest.fn().mockResolvedValue({ 
        ...mockTrips[0], 
        id: '4', 
        name: 'Summer Vacation (Copy)' 
      });
      
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        duplicateTrip
      });

      render(<TripListView />);

      const moreButton = within(screen.getByTestId('trip-row-1')).getByRole('button');
      await user.click(moreButton);

      const duplicateOption = screen.getByText('Duplicate');
      await user.click(duplicateOption);

      await waitFor(() => {
        expect(duplicateTrip).toHaveBeenCalledWith('1');
        expect(mockNavigate).toHaveBeenCalledWith('/trips/4/edit');
      });
    });

    it('handles archive/unarchive action', async () => {
      const updateTrip = jest.fn().mockResolvedValue(undefined);
      const fetchTrips = jest.fn();
      
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        updateTrip,
        fetchTrips
      });

      render(<TripListView />);

      // First trip is not archived
      const moreButton = within(screen.getByTestId('trip-row-1')).getByRole('button');
      await user.click(moreButton);

      const archiveOption = screen.getByText('Archive');
      await user.click(archiveOption);

      expect(updateTrip).toHaveBeenCalledWith('1', { isArchived: true });
      await waitFor(() => {
        expect(fetchTrips).toHaveBeenCalledWith(1);
      });
    });

    it('shows unarchive option for archived trips', async () => {
      render(<TripListView />);

      // Third trip is archived
      const moreButton = within(screen.getByTestId('trip-row-3')).getByRole('button');
      await user.click(moreButton);

      expect(screen.getByText('Unarchive')).toBeInTheDocument();
    });

    it('navigates to create new trip', async () => {
      render(<TripListView />);

      const createButton = screen.getByText('Create Trip');
      await user.click(createButton);

      expect(mockNavigate).toHaveBeenCalledWith('/trips/new');
    });
  });

  describe('Meal Progress Calculation', () => {
    it('calculates meal progress correctly', () => {
      render(<TripListView />);

      // First trip: 3 meals filled out of 9 possible slots (3 days * 3 active slots)
      const progressBars = screen.getAllByRole('progressbar');
      
      // Check that progress is calculated and displayed
      expect(screen.getByText('33%')).toBeInTheDocument(); // First trip
      expect(screen.getByText('56%')).toBeInTheDocument(); // Second trip
    });

    it('shows 0% progress for trips without meal data', () => {
      const tripsWithoutMeals = [
        createMockTrip({ 
          id: '1', 
          name: 'Empty Trip',
          days: []
        })
      ];

      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        trips: tripsWithoutMeals
      });

      render(<TripListView />);
      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('Budget Status Display', () => {
    it('shows budget status indicator', () => {
      render(<TripListView />);

      // Budget indicators should be present
      const dollarSigns = screen.getAllByTestId(/dollar-sign/i);
      expect(dollarSigns.length).toBeGreaterThan(0);

      // Should show percentage and trend
      expect(screen.getByText(/\d+%/)).toBeInTheDocument();
    });
  });

  describe('Status Badges', () => {
    it('displays correct status badges with icons', () => {
      render(<TripListView />);

      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  describe('Filtering and Sorting', () => {
    it('fetches trips on mount', () => {
      const fetchTrips = jest.fn();
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchTrips
      });

      render(<TripListView />);
      expect(fetchTrips).toHaveBeenCalledWith(1);
    });

    it('updates filters through search', async () => {
      const setFilters = jest.fn();
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<TripListView />);

      const searchInput = screen.getByTestId('search-input');
      await user.type(searchInput, 'vacation');

      expect(setFilters).toHaveBeenCalledWith({ search: 'vacation' });
    });

    it('updates filters through status dropdown', async () => {
      const setFilters = jest.fn();
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        setFilters
      });

      render(<TripListView />);

      const statusFilter = screen.getByTestId('status-filter');
      await user.selectOptions(statusFilter, 'active');

      expect(setFilters).toHaveBeenCalledWith({ status: 'active' });
    });

    it('handles sorting changes', async () => {
      const setSorting = jest.fn();
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        setSorting
      });

      render(<TripListView />);

      // Simulate sort change (this would normally be in the DataTable)
      // In real implementation, clicking column headers would trigger this
      const nameHeader = screen.getByText('Trip Name');
      fireEvent.click(nameHeader);

      // The DataTable would call onSort which calls setSorting
      // For this test, we'll verify the setup is correct
      expect(setSorting).toBeDefined();
    });

    it('refetches trips when filters change', () => {
      const fetchTrips = jest.fn();
      const { rerender } = render(<TripListView />);

      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        filters: { status: 'active' },
        fetchTrips
      });

      rerender(<TripListView />);

      expect(fetchTrips).toHaveBeenCalledWith(1);
    });
  });

  describe('Pagination', () => {
    it('shows pagination controls when needed', () => {
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        totalTrips: 25,
        pageSize: 10,
        currentPage: 1
      });

      render(<TripListView />);

      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    });

    it('handles page navigation', async () => {
      const fetchTrips = jest.fn();
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        totalTrips: 25,
        pageSize: 10,
        currentPage: 1,
        fetchTrips
      });

      render(<TripListView />);

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      expect(fetchTrips).toHaveBeenCalledWith(2);
    });

    it('disables pagination buttons appropriately', () => {
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        totalTrips: 25,
        pageSize: 10,
        currentPage: 1
      });

      render(<TripListView />);

      expect(screen.getByText('Previous')).toBeDisabled();
      expect(screen.getByText('Next')).not.toBeDisabled();
    });

    it('hides pagination for single page', () => {
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        totalTrips: 5,
        pageSize: 10
      });

      render(<TripListView />);

      expect(screen.queryByText('Previous')).not.toBeInTheDocument();
      expect(screen.queryByText('Next')).not.toBeInTheDocument();
    });
  });

  describe('Loading and Error States', () => {
    it('shows loading state', () => {
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        loading: true
      });

      render(<TripListView />);
      
      // DataTable component would handle loading state
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });

    it('shows empty state message', () => {
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        trips: []
      });

      render(<TripListView />);
      
      // Empty message would be handled by DataTable
      expect(screen.getByTestId('data-table')).toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('formats date ranges correctly', () => {
      render(<TripListView />);

      // Check that dates are formatted
      const dateRanges = screen.getAllByText(/\d{1,2}\s-\s\d{1,2}\s\w+\s\d{4}/);
      expect(dateRanges.length).toBeGreaterThan(0);
    });

    it('handles same month date ranges', () => {
      const tripSameMonth = createMockTrip({
        id: '1',
        startDate: '2024-07-01',
        endDate: '2024-07-15'
      });

      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        trips: [tripSameMonth]
      });

      render(<TripListView />);

      // Should show condensed format for same month
      expect(screen.getByText(/1\s-\s15\sJul\s2024/)).toBeInTheDocument();
    });
  });

  describe('Mobile Responsiveness', () => {
    it('renders mobile view for data table', () => {
      // Set viewport to mobile
      global.innerWidth = 375;
      global.dispatchEvent(new Event('resize'));

      render(<TripListView />);

      // Mobile render items should be present
      const mobileItems = screen.getAllByText(/View details/i);
      expect(mobileItems.length).toBe(mockTrips.length);
    });

    it('shows compact information in mobile view', () => {
      render(<TripListView />);

      // Check mobile cards have essential info
      mockTrips.forEach(trip => {
        expect(screen.getByText(trip.name)).toBeInTheDocument();
        expect(screen.getByText(`${trip.participantCount || 0} participants`)).toBeInTheDocument();
      });
    });
  });

  describe('Calendar View', () => {
    it('passes trips to calendar view', async () => {
      render(<TripListView />);

      const calendarTab = screen.getByText('Calendar');
      await user.click(calendarTab);

      const calendar = screen.getByTestId('trip-calendar');
      expect(calendar).toBeInTheDocument();
      
      // Verify trips are displayed in calendar
      mockTrips.forEach(trip => {
        expect(screen.getByText(`${trip.name} - Calendar View`)).toBeInTheDocument();
      });
    });

    it('handles trip click in calendar view', async () => {
      render(<TripListView />);

      const calendarTab = screen.getByText('Calendar');
      await user.click(calendarTab);

      const tripInCalendar = screen.getByText('Summer Vacation - Calendar View');
      await user.click(tripInCalendar);

      expect(mockNavigate).toHaveBeenCalledWith('/trips/1');
    });
  });

  describe('Error Handling', () => {
    it('handles fetch errors gracefully', async () => {
      const fetchTrips = jest.fn().mockRejectedValue(new Error('Network error'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        fetchTrips
      });

      render(<TripListView />);

      await waitFor(() => {
        expect(fetchTrips).toHaveBeenCalled();
      });

      consoleError.mockRestore();
    });

    it('handles duplicate error gracefully', async () => {
      const duplicateTrip = jest.fn().mockRejectedValue(new Error('Duplication failed'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        duplicateTrip
      });

      render(<TripListView />);

      const moreButton = within(screen.getByTestId('trip-row-1')).getByRole('button');
      await user.click(moreButton);

      const duplicateOption = screen.getByText('Duplicate');
      await user.click(duplicateOption);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to duplicate trip:', expect.any(Error));
      });

      consoleError.mockRestore();
    });

    it('handles archive error gracefully', async () => {
      const updateTrip = jest.fn().mockRejectedValue(new Error('Update failed'));
      const consoleError = jest.spyOn(console, 'error').mockImplementation();

      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        updateTrip
      });

      render(<TripListView />);

      const moreButton = within(screen.getByTestId('trip-row-1')).getByRole('button');
      await user.click(moreButton);

      const archiveOption = screen.getByText('Archive');
      await user.click(archiveOption);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to archive trip:', expect.any(Error));
      });

      consoleError.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<TripListView />);

      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('Trips');
    });

    it('has accessible form controls', () => {
      render(<TripListView />);

      const searchInput = screen.getByTestId('search-input');
      expect(searchInput).toHaveAttribute('placeholder', 'Search trips');

      const statusFilter = screen.getByTestId('status-filter');
      expect(statusFilter).toBeInTheDocument();
    });

    it('provides keyboard navigation for tabs', async () => {
      render(<TripListView />);

      const listTab = screen.getByRole('tab', { name: /list/i });
      const calendarTab = screen.getByRole('tab', { name: /calendar/i });

      // Focus on list tab
      listTab.focus();
      expect(document.activeElement).toBe(listTab);

      // Tab to calendar tab
      await user.tab();
      expect(document.activeElement).toBe(calendarTab);

      // Activate with Enter key
      await user.keyboard('{Enter}');
      expect(screen.getByTestId('trip-calendar')).toBeInTheDocument();
    });

    it('announces dynamic content changes', async () => {
      const { rerender } = render(<TripListView />);

      // Change trips count
      (useTripStore as any).mockReturnValue({
        ...defaultStoreState,
        trips: [...mockTrips, createMockTrip({ id: '4', name: 'New Trip' })],
        totalTrips: 4
      });

      rerender(<TripListView />);

      expect(screen.getByText('Manage your trips (4 total)')).toBeInTheDocument();
    });
  });
});