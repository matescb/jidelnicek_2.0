import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { Check, ChevronsUpDown, X, Loader2, Search, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from './badge'
import { Button } from './button'
import { Input } from './input'
import { VirtualizedList } from './VirtualizedList'
import { cva, type VariantProps } from 'class-variance-authority'

const comboboxVariants = cva(
  'flex min-h-10 w-full rounded-md border bg-background text-sm ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'min-h-8 text-xs',
        md: 'min-h-10 text-sm',
        lg: 'min-h-12 text-base',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
)

export interface ComboboxOption<T = any> {
  value: string
  label: string
  disabled?: boolean
  group?: string
  data?: T
}

export interface ComboboxProps<T = any> extends VariantProps<typeof comboboxVariants> {
  options: ComboboxOption<T>[]
  value?: string | string[]
  onChange?: (value: string | string[] | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  loadingMessage?: string
  createMessage?: (search: string) => string
  multiple?: boolean
  disabled?: boolean
  loading?: boolean
  async?: boolean
  onSearch?: (search: string) => void | Promise<void>
  onCreate?: (search: string) => void | Promise<void>
  allowCreate?: boolean
  clearable?: boolean
  virtualize?: boolean
  virtualItemHeight?: number
  className?: string
  renderOption?: (option: ComboboxOption<T>, isSelected: boolean) => React.ReactNode
  filterOption?: (option: ComboboxOption<T>, search: string) => boolean
  groupSort?: (a: string, b: string) => number
  maxSelectedDisplay?: number
  error?: boolean
}

export function Combobox<T = any>({
  options = [],
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found.',
  loadingMessage = 'Loading...',
  createMessage = (search) => `Create "${search}"`,
  multiple = false,
  disabled = false,
  loading = false,
  async = false,
  onSearch,
  onCreate,
  allowCreate = false,
  clearable = true,
  virtualize = true,
  virtualItemHeight = 40,
  className,
  renderOption,
  filterOption,
  groupSort,
  maxSelectedDisplay = 3,
  error = false,
  size = 'md',
}: ComboboxProps<T>) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [isSearching, setIsSearching] = React.useState(false)
  const [highlightedIndex, setHighlightedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const searchTimeoutRef = React.useRef<NodeJS.Timeout>()

  // Normalize value to always be an array for easier handling
  const selectedValues = React.useMemo(() => {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  }, [value])

  // Get selected options
  const selectedOptions = React.useMemo(() => {
    return options.filter(option => selectedValues.includes(option.value))
  }, [options, selectedValues])

  // Default filter function
  const defaultFilter = React.useCallback((option: ComboboxOption<T>, searchTerm: string) => {
    return option.label.toLowerCase().includes(searchTerm.toLowerCase())
  }, [])

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search && !async) return options
    if (async && !search) return options
    
    const filterFn = filterOption || defaultFilter
    return options.filter(option => filterFn(option, search))
  }, [options, search, async, filterOption, defaultFilter])

  // Group options
  const groupedOptions = React.useMemo(() => {
    const groups = new Map<string | undefined, ComboboxOption<T>[]>()
    
    filteredOptions.forEach(option => {
      const group = option.group
      if (!groups.has(group)) {
        groups.set(group, [])
      }
      groups.get(group)!.push(option)
    })

    // Sort groups if custom sort provided
    if (groupSort) {
      const sortedGroups = new Map(
        Array.from(groups.entries()).sort(([a], [b]) => {
          if (a === undefined) return 1
          if (b === undefined) return -1
          return groupSort(a, b)
        })
      )
      return sortedGroups
    }

    return groups
  }, [filteredOptions, groupSort])

  // Flattened options for keyboard navigation
  const flatOptions = React.useMemo(() => {
    const flat: ComboboxOption<T>[] = []
    groupedOptions.forEach(options => {
      flat.push(...options.filter(opt => !opt.disabled))
    })
    return flat
  }, [groupedOptions])

  // Handle search with debouncing for async mode
  const handleSearch = React.useCallback((value: string) => {
    setSearch(value)
    setHighlightedIndex(0)

    if (async && onSearch) {
      clearTimeout(searchTimeoutRef.current)
      setIsSearching(true)
      
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          await onSearch(value)
        } finally {
          setIsSearching(false)
        }
      }, 300)
    }
  }, [async, onSearch])

  // Handle option selection
  const handleSelect = React.useCallback((option: ComboboxOption<T>) => {
    if (option.disabled) return

    let newValue: string | string[] | null

    if (multiple) {
      if (selectedValues.includes(option.value)) {
        newValue = selectedValues.filter(v => v !== option.value)
      } else {
        newValue = [...selectedValues, option.value]
      }
      if (newValue.length === 0) newValue = null
    } else {
      newValue = option.value
      setOpen(false)
    }

    onChange?.(newValue)
    setSearch('')
  }, [multiple, selectedValues, onChange])

  // Handle clear
  const handleClear = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onChange?.(null)
    setSearch('')
  }, [onChange])

  // Handle create
  const handleCreate = React.useCallback(async () => {
    if (!onCreate || !search) return
    
    setIsSearching(true)
    try {
      await onCreate(search)
      setSearch('')
    } finally {
      setIsSearching(false)
    }
  }, [onCreate, search])

  // Remove selected value (for multiple mode)
  const handleRemove = React.useCallback((valueToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!multiple) return
    
    const newValue = selectedValues.filter(v => v !== valueToRemove)
    onChange?.(newValue.length > 0 ? newValue : null)
  }, [multiple, selectedValues, onChange])

  // Keyboard navigation
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < flatOptions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev)
        break
      case 'Enter':
        e.preventDefault()
        if (flatOptions[highlightedIndex]) {
          handleSelect(flatOptions[highlightedIndex])
        } else if (allowCreate && search && onCreate) {
          handleCreate()
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }, [open, flatOptions, highlightedIndex, handleSelect, allowCreate, search, onCreate, handleCreate])

  // Show create option
  const showCreateOption = allowCreate && search && onCreate && 
    !filteredOptions.some(opt => opt.label.toLowerCase() === search.toLowerCase())

  // Render grouped options
  const renderOptions = () => {
    if (loading || isSearching) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">{loadingMessage}</span>
        </div>
      )
    }

    if (filteredOptions.length === 0 && !showCreateOption) {
      return (
        <div className="py-6 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      )
    }

    const items: React.ReactNode[] = []
    let itemIndex = 0

    groupedOptions.forEach((groupOptions, groupName) => {
      if (groupName) {
        items.push(
          <div key={`group-${groupName}`} className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            {groupName}
          </div>
        )
      }

      groupOptions.forEach(option => {
        const isSelected = selectedValues.includes(option.value)
        const isHighlighted = itemIndex === highlightedIndex && !option.disabled
        itemIndex++

        items.push(
          <div
            key={option.value}
            className={cn(
              'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
              option.disabled && 'pointer-events-none opacity-50',
              isHighlighted && 'bg-accent text-accent-foreground',
              !isHighlighted && !option.disabled && 'hover:bg-accent hover:text-accent-foreground'
            )}
            onClick={() => handleSelect(option)}
            onMouseEnter={() => !option.disabled && setHighlightedIndex(flatOptions.indexOf(option))}
          >
            {renderOption ? (
              renderOption(option, isSelected)
            ) : (
              <>
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    isSelected ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {option.label}
              </>
            )}
          </div>
        )
      })
    })

    if (showCreateOption) {
      items.push(
        <div
          key="create-option"
          className={cn(
            'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
            'bg-accent text-accent-foreground'
          )}
          onClick={handleCreate}
        >
          <Plus className="mr-2 h-4 w-4" />
          {createMessage(search)}
        </div>
      )
    }

    return items
  }

  // Render trigger content
  const renderTriggerContent = () => {
    if (multiple && selectedOptions.length > 0) {
      const displayOptions = selectedOptions.slice(0, maxSelectedDisplay)
      const remainingCount = selectedOptions.length - maxSelectedDisplay

      return (
        <div className="flex flex-wrap gap-1 p-1">
          {displayOptions.map(option => (
            <Badge
              key={option.value}
              variant="secondary"
              size="sm"
              className="pr-1"
            >
              {option.label}
              <button
                type="button"
                className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={(e) => handleRemove(option.value, e)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {remainingCount > 0 && (
            <Badge variant="secondary" size="sm">
              +{remainingCount}
            </Badge>
          )}
        </div>
      )
    }

    if (!multiple && selectedOptions.length > 0) {
      return (
        <span className="block truncate">{selectedOptions[0].label}</span>
      )
    }

    return (
      <span className="text-muted-foreground">{placeholder}</span>
    )
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <div
          className={cn(
            comboboxVariants({ size }),
            error && 'border-error-500 focus-within:ring-error-500',
            'cursor-pointer items-center justify-between px-3 py-2',
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-disabled={disabled}
          onKeyDown={handleKeyDown}
          tabIndex={disabled ? -1 : 0}
        >
          <div className="flex-1 overflow-hidden">
            {renderTriggerContent()}
          </div>
          <div className="flex items-center gap-1 ml-2">
            {clearable && selectedValues.length > 0 && !disabled && (
              <button
                type="button"
                className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={handleClear}
              >
                <X className="h-4 w-4 opacity-50 hover:opacity-100" />
              </button>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </div>
      </PopoverPrimitive.Trigger>
      
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className={cn(
            'z-50 w-full min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
            'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
          )}
          align="start"
          sideOffset={4}
          style={{
            width: 'var(--radix-popover-trigger-width)',
            maxHeight: 'min(var(--radix-popover-content-available-height), 384px)',
          }}
        >
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-4 w-4 opacity-50 mr-2" />
            <Input
              ref={inputRef}
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-8 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              onKeyDown={handleKeyDown}
            />
          </div>
          
          <div ref={listRef} className="max-h-[300px] overflow-y-auto p-1">
            {virtualize && filteredOptions.length > 20 ? (
              <VirtualizedList
                items={renderOptions() as React.ReactNode[]}
                itemHeight={virtualItemHeight}
                renderItem={(item) => item}
                className="h-full"
              />
            ) : (
              renderOptions()
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}