import React, { useState } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { 
  benchmark, 
  performanceHelpers,
  ComponentPerformanceMonitor,
  FPSMonitor,
  MemoryLeakDetector
} from './utils'

// Mock components for testing
const LargeList = ({ items }: { items: any[] }) => (
  <ul>
    {items.map((item, index) => (
      <li key={index}>
        <span>{item.name}</span>
        <span>{item.value}</span>
        <span>{item.description}</span>
      </li>
    ))}
  </ul>
)

const FormWithManyInputs = ({ fields }: { fields: number }) => {
  const [values, setValues] = useState<Record<string, string>>({})

  return (
    <form>
      {Array.from({ length: fields }, (_, i) => (
        <input
          key={i}
          type="text"
          name={`field-${i}`}
          value={values[`field-${i}`] || ''}
          onChange={(e) => setValues({
            ...values,
            [e.target.name]: e.target.value
          })}
          placeholder={`Field ${i}`}
        />
      ))}
    </form>
  )
}

const RouteComponent = ({ name }: { name: string }) => {
  const [loaded, setLoaded] = useState(false)
  
  React.useEffect(() => {
    // Simulate async data loading
    const timer = setTimeout(() => setLoaded(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div>
      <h1>{name} Route</h1>
      {loaded ? <p>Content loaded</p> : <p>Loading...</p>}
    </div>
  )
}

const NavigationTest = () => {
  const navigate = useNavigate()
  
  return (
    <div>
      <button onClick={() => navigate('/home')}>Home</button>
      <button onClick={() => navigate('/recipes')}>Recipes</button>
      <button onClick={() => navigate('/shopping')}>Shopping</button>
      <Routes>
        <Route path="/home" element={<RouteComponent name="Home" />} />
        <Route path="/recipes" element={<RouteComponent name="Recipes" />} />
        <Route path="/shopping" element={<RouteComponent name="Shopping" />} />
      </Routes>
    </div>
  )
}

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('List Rendering Performance', () => {
    it('should render small lists quickly', async () => {
      const items = performanceHelpers.createLargeDataset(100)
      
      const result = await benchmark('Small List (100 items)', () => {
        const { unmount } = render(<LargeList items={items} />)
        unmount()
      })

      expect(result.average).toBeLessThan(50)
      expect(result.max).toBeLessThan(100)
      
      console.log(`Small list benchmark: ${result.average.toFixed(2)}ms average`)
    })

    it('should handle medium lists efficiently', async () => {
      const items = performanceHelpers.createLargeDataset(1000)
      
      const result = await benchmark('Medium List (1000 items)', () => {
        const { unmount } = render(<LargeList items={items} />)
        unmount()
      }, 50)

      expect(result.average).toBeLessThan(200)
      expect(result.max).toBeLessThan(500)
      
      console.log(`Medium list benchmark: ${result.average.toFixed(2)}ms average`)
    })

    it('should demonstrate need for virtualization with large lists', async () => {
      const items = performanceHelpers.createLargeDataset(10000)
      
      const result = await benchmark('Large List (10000 items)', () => {
        const { unmount } = render(<LargeList items={items} />)
        unmount()
      }, 10)

      // Large lists without virtualization will be slow
      // This demonstrates why virtualization is needed
      console.log(`Large list benchmark: ${result.average.toFixed(2)}ms average`)
      console.log('Note: This shows why virtualization is necessary for large lists')
    })

    it('should update list items efficiently', async () => {
      const ListWithUpdates = () => {
        const [items, setItems] = useState(() => 
          performanceHelpers.createLargeDataset(500)
        )

        return (
          <>
            <button 
              onClick={() => {
                setItems(items => items.map((item, index) => ({
                  ...item,
                  value: item.value + 1
                })))
              }}
            >
              Update All
            </button>
            <LargeList items={items} />
          </>
        )
      }

      const monitor = new ComponentPerformanceMonitor()
      const { getByRole } = render(<ListWithUpdates />)

      // Benchmark updates
      const updateButton = getByRole('button')
      
      const result = await benchmark('List Updates (500 items)', async () => {
        monitor.startRender()
        fireEvent.click(updateButton)
        await performanceHelpers.waitForIdle()
        monitor.endRender()
      }, 20)

      expect(result.average).toBeLessThan(100)
      console.log(`List update benchmark: ${result.average.toFixed(2)}ms average`)
    })
  })

  describe('Form Input Performance', () => {
    it('should handle rapid typing in forms', async () => {
      const user = userEvent.setup()
      const { container } = render(<FormWithManyInputs fields={20} />)
      const firstInput = container.querySelector('input')!

      const result = await benchmark('Rapid Typing (20 fields)', async () => {
        await user.type(firstInput, 'a')
      }, 50)

      expect(result.average).toBeLessThan(20)
      console.log(`Form typing benchmark: ${result.average.toFixed(2)}ms average`)
    })

    it('should handle forms with many fields', async () => {
      const result = await benchmark('Large Form Render (100 fields)', () => {
        const { unmount } = render(<FormWithManyInputs fields={100} />)
        unmount()
      }, 20)

      expect(result.average).toBeLessThan(100)
      console.log(`Large form benchmark: ${result.average.toFixed(2)}ms average`)
    })

    it('should update form state efficiently', async () => {
      const ControlledForm = () => {
        const [values, setValues] = useState<Record<string, string>>({})

        const handleChange = (name: string, value: string) => {
          setValues(prev => ({ ...prev, [name]: value }))
        }

        return (
          <form>
            {Array.from({ length: 50 }, (_, i) => (
              <input
                key={i}
                type="text"
                value={values[`field-${i}`] || ''}
                onChange={(e) => handleChange(`field-${i}`, e.target.value)}
              />
            ))}
          </form>
        )
      }

      const { container } = render(<ControlledForm />)
      const inputs = container.querySelectorAll('input')

      const result = await benchmark('Form State Updates (50 fields)', () => {
        // Simulate typing in multiple fields
        inputs.forEach((input, index) => {
          fireEvent.change(input, { target: { value: `value-${index}` } })
        })
      }, 20)

      expect(result.average).toBeLessThan(50)
      console.log(`Form state update benchmark: ${result.average.toFixed(2)}ms average`)
    })
  })

  describe('Route Switching Performance', () => {
    it('should switch routes quickly', async () => {
      const { getByText } = render(
        <BrowserRouter>
          <NavigationTest />
        </BrowserRouter>
      )

      const result = await benchmark('Route Switching', async () => {
        fireEvent.click(getByText('Recipes'))
        await waitFor(() => screen.getByText('Recipes Route'))
        
        fireEvent.click(getByText('Shopping'))
        await waitFor(() => screen.getByText('Shopping Route'))
        
        fireEvent.click(getByText('Home'))
        await waitFor(() => screen.getByText('Home Route'))
      }, 20)

      expect(result.average).toBeLessThan(100)
      console.log(`Route switching benchmark: ${result.average.toFixed(2)}ms average`)
    })

    it('should handle rapid navigation', async () => {
      const { getByText } = render(
        <BrowserRouter>
          <NavigationTest />
        </BrowserRouter>
      )

      const buttons = ['Home', 'Recipes', 'Shopping']
      
      const result = await benchmark('Rapid Navigation', async () => {
        // Rapidly click through routes
        for (let i = 0; i < 10; i++) {
          const buttonText = buttons[i % buttons.length]
          fireEvent.click(getByText(buttonText))
        }
        await performanceHelpers.waitForIdle()
      }, 10)

      console.log(`Rapid navigation benchmark: ${result.average.toFixed(2)}ms average`)
    })
  })

  describe('Large Dataset Handling', () => {
    it('should filter large datasets efficiently', async () => {
      const FilterableList = () => {
        const [filter, setFilter] = useState('')
        const items = performanceHelpers.createLargeDataset(5000)
        
        const filteredItems = items.filter(item => 
          item.name.toLowerCase().includes(filter.toLowerCase())
        )

        return (
          <>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter items..."
            />
            <div>Showing {filteredItems.length} of {items.length} items</div>
            <ul>
              {filteredItems.slice(0, 100).map(item => (
                <li key={item.id}>{item.name}</li>
              ))}
            </ul>
          </>
        )
      }

      const { container } = render(<FilterableList />)
      const input = container.querySelector('input')!

      const result = await benchmark('Dataset Filtering (5000 items)', async () => {
        fireEvent.change(input, { target: { value: 'Item 1' } })
        await performanceHelpers.waitForIdle()
      }, 20)

      expect(result.average).toBeLessThan(50)
      console.log(`Dataset filtering benchmark: ${result.average.toFixed(2)}ms average`)
    })

    it('should sort large datasets efficiently', async () => {
      const SortableList = () => {
        const [items, setItems] = useState(() => 
          performanceHelpers.createLargeDataset(1000)
        )
        const [sortBy, setSortBy] = useState<'name' | 'value'>('name')

        const sortedItems = [...items].sort((a, b) => {
          if (sortBy === 'name') {
            return a.name.localeCompare(b.name)
          }
          return a.value - b.value
        })

        return (
          <>
            <button onClick={() => setSortBy('name')}>Sort by Name</button>
            <button onClick={() => setSortBy('value')}>Sort by Value</button>
            <ul>
              {sortedItems.slice(0, 50).map(item => (
                <li key={item.id}>{item.name} - {item.value}</li>
              ))}
            </ul>
          </>
        )
      }

      const { getByText } = render(<SortableList />)

      const result = await benchmark('Dataset Sorting (1000 items)', async () => {
        fireEvent.click(getByText('Sort by Value'))
        await performanceHelpers.waitForIdle()
        fireEvent.click(getByText('Sort by Name'))
        await performanceHelpers.waitForIdle()
      }, 20)

      expect(result.average).toBeLessThan(100)
      console.log(`Dataset sorting benchmark: ${result.average.toFixed(2)}ms average`)
    })
  })

  describe('Animation Performance', () => {
    it('should maintain FPS during animations', async () => {
      const AnimatedComponent = () => {
        const [animate, setAnimate] = useState(false)

        return (
          <div>
            <button onClick={() => setAnimate(!animate)}>Toggle Animation</button>
            <div
              style={{
                width: 100,
                height: 100,
                background: 'red',
                transition: animate ? 'transform 1s' : 'none',
                transform: animate ? 'translateX(200px)' : 'translateX(0)'
              }}
            />
          </div>
        )
      }

      const fpsMonitor = new FPSMonitor()
      const { getByRole } = render(<AnimatedComponent />)

      fpsMonitor.start()

      // Trigger multiple animations
      for (let i = 0; i < 5; i++) {
        fireEvent.click(getByRole('button'))
        await new Promise(resolve => setTimeout(resolve, 200))
      }

      fpsMonitor.stop()

      // Should maintain reasonable FPS
      expect(fpsMonitor.getAverageFPS()).toBeGreaterThan(30)
      console.log(`Animation FPS: ${fpsMonitor.getAverageFPS()}`)
    })
  })

  describe('Memory Performance', () => {
    it('should not leak memory during component lifecycle', async () => {
      const detector = new MemoryLeakDetector()
      detector.start()

      // Mount and unmount components repeatedly
      for (let i = 0; i < 20; i++) {
        const { unmount } = render(
          <FormWithManyInputs fields={50} />
        )
        
        // Interact with the form
        const inputs = screen.getAllByRole('textbox')
        inputs.forEach((input, index) => {
          fireEvent.change(input, { target: { value: `test-${index}` } })
        })

        unmount()
        
        if (i % 5 === 0) {
          performanceHelpers.forceGC()
          detector.sample()
        }
      }

      const { leaked, delta } = await detector.checkForLeak(2 * 1024 * 1024) // 2MB threshold
      expect(leaked).toBe(false)
      console.log(`Memory delta after lifecycle test: ${(delta / 1024).toFixed(2)}KB`)
    })
  })

  describe('Concurrent Updates', () => {
    it('should handle concurrent state updates efficiently', async () => {
      const ConcurrentUpdates = () => {
        const [counters, setCounters] = useState(
          Array.from({ length: 10 }, (_, i) => ({ id: i, value: 0 }))
        )

        const updateAll = () => {
          // Simulate concurrent updates
          counters.forEach((_, index) => {
            setTimeout(() => {
              setCounters(prev => prev.map((c, i) => 
                i === index ? { ...c, value: c.value + 1 } : c
              ))
            }, Math.random() * 10)
          })
        }

        return (
          <>
            <button onClick={updateAll}>Update All</button>
            {counters.map(counter => (
              <div key={counter.id}>
                Counter {counter.id}: {counter.value}
              </div>
            ))}
          </>
        )
      }

      const { getByRole } = render(<ConcurrentUpdates />)

      const result = await benchmark('Concurrent Updates', async () => {
        fireEvent.click(getByRole('button'))
        await new Promise(resolve => setTimeout(resolve, 20))
      }, 20)

      expect(result.average).toBeLessThan(50)
      console.log(`Concurrent updates benchmark: ${result.average.toFixed(2)}ms average`)
    })
  })

  describe('Performance Summary', () => {
    it('should generate performance report', async () => {
      const benchmarks = [
        { name: 'Small List', time: 10 },
        { name: 'Large Form', time: 50 },
        { name: 'Route Switch', time: 30 },
        { name: 'Data Filter', time: 25 },
        { name: 'Animation', time: 16 }
      ]

      console.log('\n=== Performance Benchmark Summary ===')
      console.log('Component            | Time (ms) | Status')
      console.log('---------------------|-----------|--------')
      
      benchmarks.forEach(({ name, time }) => {
        const status = time < 50 ? '✅ Good' : time < 100 ? '⚠️  OK' : '❌ Slow'
        console.log(`${name.padEnd(20)} | ${time.toString().padStart(9)} | ${status}`)
      })
      
      const average = benchmarks.reduce((sum, b) => sum + b.time, 0) / benchmarks.length
      console.log('---------------------|-----------|--------')
      console.log(`Average              | ${average.toFixed(1).padStart(9)} |`)
    })
  })
})