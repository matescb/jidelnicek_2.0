import React, { useState, useRef, useEffect } from 'react'
import { Check, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

export interface MultiSelectProps {
  options: MultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  maxHeight?: string
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  value = [],
  onChange,
  placeholder = 'Select items...',
  className,
  disabled = false,
  maxHeight = '200px'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Handle option selection
  const handleOptionClick = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  // Handle removing a selected item
  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter(v => v !== optionValue))
  }

  // Get label for a value
  const getLabel = (val: string) => {
    return options.find(opt => opt.value === val)?.label || val
  }

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Trigger */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-1 min-h-[38px] px-3 py-1.5 border border-gray-300 rounded-md cursor-pointer',
          'hover:border-gray-400 focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-transparent',
          disabled && 'opacity-50 cursor-not-allowed hover:border-gray-300',
          isOpen && 'ring-2 ring-primary-500 border-transparent'
        )}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        {value.length === 0 ? (
          <span className="text-gray-500">{placeholder}</span>
        ) : (
          value.map(val => (
            <span
              key={val}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-sm bg-primary-100 text-primary-800 rounded-md"
            >
              {getLabel(val)}
              <button
                type="button"
                onClick={(e) => handleRemove(val, e)}
                className="hover:text-primary-900"
                disabled={disabled}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
        <ChevronDown className={cn(
          'w-4 h-4 ml-auto text-gray-400 transition-transform',
          isOpen && 'transform rotate-180'
        )} />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Options */}
          <div className="overflow-auto" style={{ maxHeight }}>
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No options found</div>
            ) : (
              filteredOptions.map(option => {
                const isSelected = value.includes(option.value)
                return (
                  <div
                    key={option.value}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                      'hover:bg-gray-50',
                      isSelected && 'bg-primary-50'
                    )}
                    onClick={() => handleOptionClick(option.value)}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-primary-600" />}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 text-xs text-gray-500 border-t border-gray-200">
            <span>{value.length} selected</span>
            {value.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange([])
                }}
                className="text-primary-600 hover:text-primary-700"
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}