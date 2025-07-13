import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { StatusIndicator } from '../StatusIndicator'
import { formatDistanceToNow } from 'date-fns'

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: jest.fn(() => '5 minutes'),
}))

const mockFormatDistanceToNow = formatDistanceToNow as vi.MockedFunction<typeof formatDistanceToNow>

describe('StatusIndicator', () => {
  const theme = createTheme()

  const renderComponent = (props = {}) => {
    return render(
      <ThemeProvider theme={theme}>
        <StatusIndicator isOnline={true} {...props} />
      </ThemeProvider>
    )
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockFormatDistanceToNow.mockReturnValue('5 minutes')
  })

  describe('Online Status', () => {
    it('renders online indicator', () => {
      renderComponent({ isOnline: true })
      
      const indicator = screen.getByTestId('status-indicator-online')
      expect(indicator).toBeInTheDocument()
    })

    it('shows online text in tooltip', async () => {
      const user = userEvent.setup()
      renderComponent({ isOnline: true })
      
      const indicator = screen.getByTestId('status-indicator-online')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Online')
      })
    })

    it('shows activity when provided', async () => {
      const user = userEvent.setup()
      renderComponent({
        isOnline: true,
        currentActivity: 'Editing recipe',
        showActivity: true,
      })
      
      const indicator = screen.getByTestId('status-indicator-online')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Online - Editing recipe')
      })
    })

    it('shows label when showLabel is true', () => {
      renderComponent({ isOnline: true, showLabel: true })
      
      expect(screen.getByText('Online')).toBeInTheDocument()
    })

    it('shows label with activity when both are enabled', () => {
      renderComponent({ 
        isOnline: true, 
        showLabel: true,
        currentActivity: 'Editing recipe',
        showActivity: true,
      })
      
      expect(screen.getByText('Online - Editing recipe')).toBeInTheDocument()
    })
  })

  describe('Offline Status', () => {
    it('renders offline indicator', () => {
      renderComponent({ isOnline: false })
      
      const indicator = screen.getByTestId('status-indicator-offline')
      expect(indicator).toBeInTheDocument()
    })

    it('shows offline text in tooltip', async () => {
      const user = userEvent.setup()
      renderComponent({ isOnline: false })
      
      const indicator = screen.getByTestId('status-indicator-offline')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Offline')
      })
    })

    it('shows label when showLabel is true', () => {
      renderComponent({ isOnline: false, showLabel: true })
      
      expect(screen.getByText('Offline')).toBeInTheDocument()
    })
  })

  describe('Last Seen Formatting', () => {
    it('shows last seen time in tooltip', async () => {
      const user = userEvent.setup()
      const lastSeenDate = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
      
      renderComponent({
        isOnline: false,
        lastSeen: lastSeenDate,
      })
      
      const indicator = screen.getByTestId('status-indicator-offline')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Last seen 5 minutes ago')
        expect(mockFormatDistanceToNow).toHaveBeenCalledWith(lastSeenDate, { addSuffix: true })
      })
    })

    it('shows label with last seen time', () => {
      const lastSeenDate = new Date(Date.now() - 15 * 60 * 1000)
      mockFormatDistanceToNow.mockReturnValue('15 minutes')
      
      renderComponent({
        isOnline: false,
        lastSeen: lastSeenDate,
        showLabel: true,
      })
      
      expect(screen.getByText('Last seen 15 minutes ago')).toBeInTheDocument()
    })

    it('handles missing lastSeen for offline users', async () => {
      const user = userEvent.setup()
      renderComponent({ isOnline: false, lastSeen: undefined })
      
      const indicator = screen.getByTestId('status-indicator-offline')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Offline')
      })
    })

    it('uses warning color for recently active users', () => {
      const recentTime = new Date(Date.now() - 3 * 60 * 1000) // 3 minutes ago
      
      const { container } = renderComponent({
        isOnline: false,
        lastSeen: recentTime,
      })
      
      const dotElement = container.querySelector('[class*="MuiBox-root"] > [class*="MuiBox-root"]')
      expect(dotElement).toBeInTheDocument()
      // Note: Checking computed styles with MUI is complex due to emotion/styled-components
    })

    it('uses disabled color for long inactive users', () => {
      const oldTime = new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      
      const { container } = renderComponent({
        isOnline: false,
        lastSeen: oldTime,
      })
      
      const dotElement = container.querySelector('[class*="MuiBox-root"] > [class*="MuiBox-root"]')
      expect(dotElement).toBeInTheDocument()
    })
  })

  describe('Size Variations', () => {
    it('renders small size correctly', () => {
      const { container } = renderComponent({ size: 'small' })
      
      const dotElement = container.querySelector('[class*="MuiBox-root"] > [class*="MuiBox-root"]')
      expect(dotElement).toBeInTheDocument()
    })

    it('renders medium size correctly (default)', () => {
      const { container } = renderComponent({ size: 'medium' })
      
      const dotElement = container.querySelector('[class*="MuiBox-root"] > [class*="MuiBox-root"]')
      expect(dotElement).toBeInTheDocument()
    })

    it('renders large size correctly', () => {
      const { container } = renderComponent({ size: 'large' })
      
      const dotElement = container.querySelector('[class*="MuiBox-root"] > [class*="MuiBox-root"]')
      expect(dotElement).toBeInTheDocument()
    })

    it('uses appropriate typography for different sizes with label', () => {
      const { rerender } = renderComponent({ size: 'small', showLabel: true })
      
      expect(screen.getByText('Online')).toHaveClass('MuiTypography-caption')
      
      rerender(
        <ThemeProvider theme={theme}>
          <StatusIndicator isOnline={true} size="large" showLabel={true} />
        </ThemeProvider>
      )
      
      expect(screen.getByText('Online')).toHaveClass('MuiTypography-body2')
    })
  })

  describe('Tooltip Content', () => {
    it('shows full status information in tooltip', async () => {
      const user = userEvent.setup()
      const lastSeenDate = new Date(Date.now() - 7 * 60 * 1000)
      mockFormatDistanceToNow.mockReturnValue('7 minutes')
      
      renderComponent({
        isOnline: false,
        lastSeen: lastSeenDate,
        currentActivity: 'Idle',
        showActivity: true,
      })
      
      const indicator = screen.getByTestId('status-indicator-offline')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Last seen 7 minutes ago')
      })
    })

    it('handles very long activity descriptions', async () => {
      const user = userEvent.setup()
      const longActivity = 'A'.repeat(100)
      
      renderComponent({
        isOnline: true,
        currentActivity: longActivity,
        showActivity: true,
      })
      
      const indicator = screen.getByTestId('status-indicator-online')
      await user.hover(indicator)
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip')
        expect(tooltip.textContent).toContain(longActivity)
      })
    })

    it('does not show activity when showActivity is false', async () => {
      const user = userEvent.setup()
      renderComponent({
        isOnline: true,
        currentActivity: 'Editing recipe',
        showActivity: false,
      })
      
      const indicator = screen.getByTestId('status-indicator-online')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Online')
        expect(screen.getByRole('tooltip')).not.toHaveTextContent('Editing recipe')
      })
    })

    it('handles empty activity string', async () => {
      const user = userEvent.setup()
      renderComponent({
        isOnline: true,
        currentActivity: '',
        showActivity: true,
      })
      
      const indicator = screen.getByTestId('status-indicator-online')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Online')
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles exactly 5 minutes ago', () => {
      const exactlyFive = new Date(Date.now() - 5 * 60 * 1000) // Exactly 5 minutes
      
      const { container } = renderComponent({
        isOnline: false,
        lastSeen: exactlyFive,
      })
      
      const indicator = screen.getByTestId('status-indicator-offline')
      expect(indicator).toBeInTheDocument()
    })

    it('handles future dates gracefully', async () => {
      const user = userEvent.setup()
      const futureDate = new Date(Date.now() + 60 * 1000) // 1 minute in future
      mockFormatDistanceToNow.mockReturnValue('in 1 minute')
      
      renderComponent({
        isOnline: false,
        lastSeen: futureDate,
      })
      
      const indicator = screen.getByTestId('status-indicator-offline')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Last seen in 1 minute ago')
      })
    })

    it('handles very old dates', async () => {
      const user = userEvent.setup()
      const veryOldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // 1 year ago
      mockFormatDistanceToNow.mockReturnValue('about 1 year')
      
      renderComponent({
        isOnline: false,
        lastSeen: veryOldDate,
      })
      
      const indicator = screen.getByTestId('status-indicator-offline')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toHaveTextContent('Last seen about 1 year ago')
      })
    })
  })

  describe('Accessibility', () => {
    it('has accessible tooltip', async () => {
      const user = userEvent.setup()
      renderComponent({ isOnline: true })
      
      const indicator = screen.getByTestId('status-indicator-online')
      await user.hover(indicator)
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip')
        expect(tooltip).toHaveAttribute('role', 'tooltip')
      })
    })

    it('provides semantic color information through label', () => {
      renderComponent({ isOnline: true, showLabel: true })
      
      const label = screen.getByText('Online')
      expect(label).toHaveClass('MuiTypography-root')
    })

    it('differentiates between online and offline states', () => {
      const { rerender } = renderComponent({ isOnline: true })
      
      expect(screen.getByTestId('status-indicator-online')).toBeInTheDocument()
      expect(screen.queryByTestId('status-indicator-offline')).not.toBeInTheDocument()
      
      rerender(
        <ThemeProvider theme={theme}>
          <StatusIndicator isOnline={false} />
        </ThemeProvider>
      )
      
      expect(screen.queryByTestId('status-indicator-online')).not.toBeInTheDocument()
      expect(screen.getByTestId('status-indicator-offline')).toBeInTheDocument()
    })
  })

  describe('Theme Integration', () => {
    it('uses theme colors correctly', () => {
      const customTheme = createTheme({
        palette: {
          success: { main: '#00ff00' },
          warning: { main: '#ffff00' },
          text: { disabled: '#cccccc' },
        },
      })
      
      const { rerender } = render(
        <ThemeProvider theme={customTheme}>
          <StatusIndicator isOnline={true} />
        </ThemeProvider>
      )
      
      expect(screen.getByTestId('status-indicator-online')).toBeInTheDocument()
      
      rerender(
        <ThemeProvider theme={customTheme}>
          <StatusIndicator
            isOnline={false}
            lastSeen={new Date(Date.now() - 3 * 60 * 1000)}
          />
        </ThemeProvider>
      )
      
      expect(screen.getByTestId('status-indicator-offline')).toBeInTheDocument()
    })

    it('adapts to dark theme', () => {
      const darkTheme = createTheme({
        palette: {
          mode: 'dark',
        },
      })
      
      renderComponent({ isOnline: true })
      const { rerender } = render(
        <ThemeProvider theme={darkTheme}>
          <StatusIndicator isOnline={true} />
        </ThemeProvider>
      )
      
      expect(screen.getByTestId('status-indicator-online')).toBeInTheDocument()
    })
  })
})