import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '../ThemeToggle'
import { ThemeToggleAdvanced } from '../ThemeToggleAdvanced'
import { ThemeProvider } from '@context/ThemeContext'

// Mock matchMedia
const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Mock matchMedia for light mode by default
    mockMatchMedia(false)
  })

  const renderWithTheme = (component: React.ReactElement) => {
    return render(
      <ThemeProvider>
        {component}
      </ThemeProvider>
    )
  }

  describe('Simple ThemeToggle', () => {
    it('renders correctly', () => {
      renderWithTheme(<ThemeToggle />)
      const button = screen.getByRole('button', { name: /switch to dark theme/i })
      expect(button).toBeInTheDocument()
    })

    it('toggles theme on click', async () => {
      renderWithTheme(<ThemeToggle />)
      const button = screen.getByRole('button')
      
      // Initially in light mode
      expect(button).toHaveAttribute('aria-label', 'Switch to dark theme')
      
      // Click to toggle to dark mode
      fireEvent.click(button)
      
      await waitFor(() => {
        expect(button).toHaveAttribute('aria-label', 'Switch to light theme')
      })
    })

    it('renders in compact mode', () => {
      renderWithTheme(<ThemeToggle compact />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('p-1.5')
    })

    it('shows tooltip on hover', async () => {
      renderWithTheme(<ThemeToggle />)
      const button = screen.getByRole('button')
      
      await userEvent.hover(button)
      
      await waitFor(() => {
        const tooltip = screen.getByRole('tooltip')
        expect(tooltip).toBeInTheDocument()
        expect(tooltip).toHaveTextContent('Switch to dark mode')
      })
    })

    it('hides tooltip when showTooltip is false', async () => {
      renderWithTheme(<ThemeToggle showTooltip={false} />)
      const button = screen.getByRole('button')
      
      await userEvent.hover(button)
      
      await waitFor(() => {
        const tooltip = screen.queryByRole('tooltip')
        expect(tooltip).not.toBeInTheDocument()
      })
    })

    it('applies custom className', () => {
      renderWithTheme(<ThemeToggle className="custom-class" />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
    })
  })

  describe('ThemeToggleAdvanced', () => {
    it('renders correctly with dropdown', () => {
      renderWithTheme(<ThemeToggleAdvanced />)
      const button = screen.getByRole('button', { name: /theme settings/i })
      expect(button).toBeInTheDocument()
    })

    it('opens dropdown on click', async () => {
      renderWithTheme(<ThemeToggleAdvanced />)
      const button = screen.getByRole('button', { name: /theme settings/i })
      
      fireEvent.click(button)
      
      await waitFor(() => {
        const menu = screen.getByRole('menu')
        expect(menu).toBeInTheDocument()
        expect(screen.getByText('Light')).toBeInTheDocument()
        expect(screen.getByText('Dark')).toBeInTheDocument()
        expect(screen.getByText('System')).toBeInTheDocument()
      })
    })

    it('selects light theme', async () => {
      renderWithTheme(<ThemeToggleAdvanced />)
      const button = screen.getByRole('button', { name: /theme settings/i })
      
      fireEvent.click(button)
      const lightOption = await screen.findByRole('menuitem', { name: /light/i })
      fireEvent.click(lightOption)
      
      await waitFor(() => {
        expect(localStorage.getItem('themeMode')).toBe('light')
      })
    })

    it('selects dark theme', async () => {
      renderWithTheme(<ThemeToggleAdvanced />)
      const button = screen.getByRole('button', { name: /theme settings/i })
      
      fireEvent.click(button)
      const darkOption = await screen.findByRole('menuitem', { name: /dark/i })
      fireEvent.click(darkOption)
      
      await waitFor(() => {
        expect(localStorage.getItem('themeMode')).toBe('dark')
      })
    })

    it('selects system theme', async () => {
      renderWithTheme(<ThemeToggleAdvanced />)
      const button = screen.getByRole('button', { name: /theme settings/i })
      
      fireEvent.click(button)
      const systemOption = await screen.findByRole('menuitem', { name: /system/i })
      fireEvent.click(systemOption)
      
      await waitFor(() => {
        expect(localStorage.getItem('themeMode')).toBe('system')
      })
    })

    it('closes dropdown when clicking outside', async () => {
      renderWithTheme(
        <div>
          <ThemeToggleAdvanced />
          <div data-testid="outside">Outside element</div>
        </div>
      )
      
      const button = screen.getByRole('button', { name: /theme settings/i })
      fireEvent.click(button)
      
      const menu = await screen.findByRole('menu')
      expect(menu).toBeInTheDocument()
      
      const outside = screen.getByTestId('outside')
      fireEvent.mouseDown(outside)
      
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBeInTheDocument()
      })
    })

    it('renders in compact mode', () => {
      renderWithTheme(<ThemeToggleAdvanced compact />)
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-2', 'py-1.5')
    })

    it('hides current mode when showCurrentMode is false', () => {
      renderWithTheme(<ThemeToggleAdvanced showCurrentMode={false} />)
      const button = screen.getByRole('button')
      
      // Should not show the mode text
      expect(screen.queryByText('Light')).not.toBeInTheDocument()
      expect(screen.queryByText('Dark')).not.toBeInTheDocument()
      expect(screen.queryByText('System')).not.toBeInTheDocument()
    })
  })

  describe('System theme detection', () => {
    it('respects system preference when set to system mode', async () => {
      // Mock dark mode preference
      mockMatchMedia(true)
      
      renderWithTheme(<ThemeToggleAdvanced />)
      const button = screen.getByRole('button', { name: /theme settings/i })
      
      fireEvent.click(button)
      const systemOption = await screen.findByRole('menuitem', { name: /system/i })
      fireEvent.click(systemOption)
      
      // Should apply dark theme based on system preference
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('dark')
      })
    })
  })
})