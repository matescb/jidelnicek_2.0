export interface ComboboxOption<T = any> {
  value: string
  label: string
  disabled?: boolean
  group?: string
  data?: T
}

export interface ComboboxProps<T = any> {
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
  size?: 'sm' | 'md' | 'lg'
}