/**
 * Tests for mobile-specific components
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  BottomSheet,
  TabBar,
  PullToRefresh,
  SwipeableListItem,
} from '../../components/mobile';
import {
  simulateSwipe,
  waitForAnimation,
  createTouchEvent,
  mockWindowResize,
  viewports,
} from './utils';

describe('BottomSheet', () => {
  beforeEach(() => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);
  });

  it('should render when open', () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}}>
        <div data-testid="content">Sheet Content</div>
      </BottomSheet>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <BottomSheet isOpen={false} onClose={() => {}}>
        <div data-testid="content">Sheet Content</div>
      </BottomSheet>
    );

    expect(screen.queryByTestId('content')).not.toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked', () => {
    const handleClose = jest.fn();
    render(
      <BottomSheet isOpen={true} onClose={handleClose}>
        <div>Content</div>
      </BottomSheet>
    );

    const backdrop = screen.getByRole('button', { name: /close/i });
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalled();
  });

  it('should handle swipe down to close', async () => {
    const handleClose = jest.fn();
    render(
      <BottomSheet isOpen={true} onClose={handleClose}>
        <div data-testid="sheet">Content</div>
      </BottomSheet>
    );

    const sheet = screen.getByTestId('sheet').parentElement!;
    await simulateSwipe(sheet, 0, 100, 0, 300, 200);

    expect(handleClose).toHaveBeenCalled();
  });

  it('should snap to positions', async () => {
    render(
      <BottomSheet
        isOpen={true}
        onClose={() => {}}
        snapPoints={[0.25, 0.5, 1]}
        defaultSnapPoint={0.5}
      >
        <div data-testid="sheet">Content</div>
      </BottomSheet>
    );

    const sheet = screen.getByTestId('sheet').parentElement!;
    
    // Should start at 50% height
    expect(sheet).toHaveStyle({
      transform: 'translateY(50%)',
    });

    // Swipe up to expand
    await simulateSwipe(sheet, 0, 200, 0, 50, 200);
    await waitForAnimation();

    // Should snap to 100%
    expect(sheet).toHaveStyle({
      transform: 'translateY(0%)',
    });
  });

  it('should respect height prop', () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}} height="300px">
        <div data-testid="sheet">Content</div>
      </BottomSheet>
    );

    const sheet = screen.getByTestId('sheet').parentElement!;
    expect(sheet).toHaveStyle({
      height: '300px',
    });
  });

  it('should show drag indicator when draggable', () => {
    render(
      <BottomSheet isOpen={true} onClose={() => {}} draggable>
        <div>Content</div>
      </BottomSheet>
    );

    expect(screen.getByTestId('drag-indicator')).toBeInTheDocument();
  });
});

describe('TabBar', () => {
  const mockTabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ];

  it('should render all tabs', () => {
    render(
      <TabBar
        tabs={mockTabs}
        activeTab="home"
        onTabChange={() => {}}
      />
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
  });

  it('should highlight active tab', () => {
    render(
      <TabBar
        tabs={mockTabs}
        activeTab="search"
        onTabChange={() => {}}
      />
    );

    const searchTab = screen.getByText('Search').closest('button');
    expect(searchTab).toHaveClass('active');
  });

  it('should call onTabChange when tab is clicked', () => {
    const handleChange = jest.fn();
    render(
      <TabBar
        tabs={mockTabs}
        activeTab="home"
        onTabChange={handleChange}
      />
    );

    fireEvent.click(screen.getByText('Profile'));
    expect(handleChange).toHaveBeenCalledWith('profile');
  });

  it('should render with fixed position', () => {
    render(
      <TabBar
        tabs={mockTabs}
        activeTab="home"
        onTabChange={() => {}}
        position="bottom"
      />
    );

    const tabBar = screen.getByRole('tablist');
    expect(tabBar).toHaveClass('fixed');
    expect(tabBar).toHaveClass('bottom-0');
  });

  it('should show badges', () => {
    const tabsWithBadges = [
      { ...mockTabs[0], badge: '3' },
      { ...mockTabs[1] },
      { ...mockTabs[2], badge: '99+' },
    ];

    render(
      <TabBar
        tabs={tabsWithBadges}
        activeTab="home"
        onTabChange={() => {}}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('should be keyboard accessible', () => {
    const handleChange = jest.fn();
    render(
      <TabBar
        tabs={mockTabs}
        activeTab="home"
        onTabChange={handleChange}
      />
    );

    const homeTab = screen.getByText('Home').closest('button')!;
    homeTab.focus();

    // Arrow right
    fireEvent.keyDown(homeTab, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith('search');

    // Arrow left from search should go to home
    const searchTab = screen.getByText('Search').closest('button')!;
    searchTab.focus();
    fireEvent.keyDown(searchTab, { key: 'ArrowLeft' });
    expect(handleChange).toHaveBeenCalledWith('home');
  });
});

describe('PullToRefresh', () => {
  beforeEach(() => {
    mockWindowResize(viewports.mobile.width, viewports.mobile.height);
  });

  it('should render children', () => {
    render(
      <PullToRefresh onRefresh={() => Promise.resolve()}>
        <div data-testid="content">Content</div>
      </PullToRefresh>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should show pull indicator when pulling', async () => {
    render(
      <PullToRefresh onRefresh={() => Promise.resolve()}>
        <div data-testid="content">Content</div>
      </PullToRefresh>
    );

    const container = screen.getByTestId('content').parentElement!;
    
    // Start pull
    fireEvent.touchStart(container, {
      touches: [{ clientY: 100 }],
    });

    // Pull down
    fireEvent.touchMove(container, {
      touches: [{ clientY: 180 }],
    });

    expect(screen.getByTestId('pull-indicator')).toBeInTheDocument();
  });

  it('should trigger refresh when threshold is reached', async () => {
    const handleRefresh = jest.fn(() => Promise.resolve());
    render(
      <PullToRefresh onRefresh={handleRefresh} threshold={80}>
        <div data-testid="content">Content</div>
      </PullToRefresh>
    );

    const container = screen.getByTestId('content').parentElement!;
    
    // Simulate pull past threshold
    await simulateSwipe(container, 0, 0, 0, 100, 200);

    expect(handleRefresh).toHaveBeenCalled();
  });

  it('should show loading state during refresh', async () => {
    let resolveRefresh: () => void;
    const refreshPromise = new Promise<void>((resolve) => {
      resolveRefresh = resolve;
    });

    render(
      <PullToRefresh onRefresh={() => refreshPromise}>
        <div data-testid="content">Content</div>
      </PullToRefresh>
    );

    const container = screen.getByTestId('content').parentElement!;
    
    // Trigger refresh
    await simulateSwipe(container, 0, 0, 0, 100, 200);

    // Should show loading
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    // Complete refresh
    resolveRefresh!();
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });
  });

  it('should be disabled when prop is set', async () => {
    const handleRefresh = jest.fn();
    render(
      <PullToRefresh onRefresh={handleRefresh} disabled>
        <div data-testid="content">Content</div>
      </PullToRefresh>
    );

    const container = screen.getByTestId('content').parentElement!;
    await simulateSwipe(container, 0, 0, 0, 100, 200);

    expect(handleRefresh).not.toHaveBeenCalled();
  });
});

describe('SwipeableListItem', () => {
  it('should render content', () => {
    render(
      <SwipeableListItem
        leftActions={[]}
        rightActions={[]}
      >
        <div data-testid="content">Item Content</div>
      </SwipeableListItem>
    );

    expect(screen.getByTestId('content')).toBeInTheDocument();
  });

  it('should reveal left actions on swipe right', async () => {
    const handleAction = jest.fn();
    render(
      <SwipeableListItem
        leftActions={[
          { label: 'Archive', color: 'blue', onClick: handleAction },
        ]}
        rightActions={[]}
      >
        <div data-testid="content">Item Content</div>
      </SwipeableListItem>
    );

    const item = screen.getByTestId('content').parentElement!;
    await simulateSwipe(item, 0, 0, 100, 0, 200);

    const archiveButton = screen.getByText('Archive');
    expect(archiveButton).toBeVisible();
    
    fireEvent.click(archiveButton);
    expect(handleAction).toHaveBeenCalled();
  });

  it('should reveal right actions on swipe left', async () => {
    const handleDelete = jest.fn();
    render(
      <SwipeableListItem
        leftActions={[]}
        rightActions={[
          { label: 'Delete', color: 'red', onClick: handleDelete },
        ]}
      >
        <div data-testid="content">Item Content</div>
      </SwipeableListItem>
    );

    const item = screen.getByTestId('content').parentElement!;
    await simulateSwipe(item, 100, 0, 0, 0, 200);

    const deleteButton = screen.getByText('Delete');
    expect(deleteButton).toBeVisible();
    
    fireEvent.click(deleteButton);
    expect(handleDelete).toHaveBeenCalled();
  });

  it('should snap back when swipe is not enough', async () => {
    render(
      <SwipeableListItem
        leftActions={[{ label: 'Archive', onClick: () => {} }]}
        rightActions={[]}
        threshold={50}
      >
        <div data-testid="content">Item Content</div>
      </SwipeableListItem>
    );

    const item = screen.getByTestId('content').parentElement!;
    
    // Swipe less than threshold
    await simulateSwipe(item, 0, 0, 30, 0, 200);
    await waitForAnimation();

    // Should snap back
    expect(item).toHaveStyle({
      transform: 'translateX(0px)',
    });
  });

  it('should handle multiple actions', async () => {
    const handleEdit = jest.fn();
    const handleDelete = jest.fn();
    
    render(
      <SwipeableListItem
        leftActions={[]}
        rightActions={[
          { label: 'Edit', color: 'blue', onClick: handleEdit },
          { label: 'Delete', color: 'red', onClick: handleDelete },
        ]}
      >
        <div data-testid="content">Item Content</div>
      </SwipeableListItem>
    );

    const item = screen.getByTestId('content').parentElement!;
    await simulateSwipe(item, 100, 0, -100, 0, 200);

    expect(screen.getByText('Edit')).toBeVisible();
    expect(screen.getByText('Delete')).toBeVisible();
  });

  it('should close actions when clicking outside', async () => {
    render(
      <div>
        <SwipeableListItem
          leftActions={[{ label: 'Archive', onClick: () => {} }]}
          rightActions={[]}
        >
          <div data-testid="content">Item Content</div>
        </SwipeableListItem>
        <div data-testid="outside">Outside</div>
      </div>
    );

    const item = screen.getByTestId('content').parentElement!;
    
    // Open actions
    await simulateSwipe(item, 0, 0, 100, 0, 200);
    expect(screen.getByText('Archive')).toBeVisible();

    // Click outside
    fireEvent.click(screen.getByTestId('outside'));
    await waitForAnimation();

    // Actions should be hidden
    expect(item).toHaveStyle({
      transform: 'translateX(0px)',
    });
  });
});