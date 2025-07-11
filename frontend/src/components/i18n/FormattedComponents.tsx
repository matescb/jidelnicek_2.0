import React, { memo } from 'react'
import {
  useNumberFormat,
  useCurrencyFormat,
  useDateFormat,
  useRelativeTime,
  useListFormat,
} from '../../i18n/hooks/useFormatting'

// FormattedNumber component
interface FormattedNumberProps {
  value: number
  options?: Intl.NumberFormatOptions
  compact?: boolean
  decimals?: { min?: number; max?: number }
  ordinal?: boolean
  bytes?: boolean
  className?: string
}

export const FormattedNumber = memo<FormattedNumberProps>(
  ({ value, options, compact, decimals, ordinal, bytes, className }) => {
    const { format, formatCompact, formatDecimal, formatOrdinal, formatBytes } = useNumberFormat(options)
    
    let formattedValue: string
    
    if (bytes) {
      formattedValue = formatBytes(value, decimals?.max)
    } else if (ordinal) {
      formattedValue = formatOrdinal(value)
    } else if (compact) {
      formattedValue = formatCompact(value)
    } else if (decimals) {
      formattedValue = formatDecimal(value, decimals.min, decimals.max)
    } else {
      formattedValue = format(value)
    }
    
    return <span className={className}>{formattedValue}</span>
  }
)
FormattedNumber.displayName = 'FormattedNumber'

// FormattedCurrency component
interface FormattedCurrencyProps {
  value: number
  currency?: string
  options?: Omit<Intl.NumberFormatOptions, 'style' | 'currency'>
  className?: string
}

export const FormattedCurrency = memo<FormattedCurrencyProps>(
  ({ value, currency, options, className }) => {
    const { format } = useCurrencyFormat(currency, options)
    
    return <span className={className}>{format(value)}</span>
  }
)
FormattedCurrency.displayName = 'FormattedCurrency'

// FormattedPercent component
interface FormattedPercentProps {
  value: number
  options?: Omit<Intl.NumberFormatOptions, 'style'>
  className?: string
}

export const FormattedPercent = memo<FormattedPercentProps>(
  ({ value, options, className }) => {
    const { formatPercent } = useCurrencyFormat()
    
    return <span className={className}>{formatPercent(value, options)}</span>
  }
)
FormattedPercent.displayName = 'FormattedPercent'

// FormattedDate component
interface FormattedDateProps {
  value: Date | string | number
  format?: string
  className?: string
}

export const FormattedDate = memo<FormattedDateProps>(
  ({ value, format, className }) => {
    const { format: formatDate } = useDateFormat(format)
    
    return <span className={className}>{formatDate(value)}</span>
  }
)
FormattedDate.displayName = 'FormattedDate'

// FormattedDateTime component
interface FormattedDateTimeProps {
  value: Date | string | number
  dateStyle?: Intl.DateTimeFormatOptions['dateStyle']
  timeStyle?: Intl.DateTimeFormatOptions['timeStyle']
  className?: string
}

export const FormattedDateTime = memo<FormattedDateTimeProps>(
  ({ value, dateStyle, timeStyle, className }) => {
    const { formatDateTime } = useDateFormat()
    
    return <span className={className}>{formatDateTime(value, dateStyle, timeStyle)}</span>
  }
)
FormattedDateTime.displayName = 'FormattedDateTime'

// FormattedTime component
interface FormattedTimeProps {
  value: Date | string | number
  options?: Intl.DateTimeFormatOptions
  className?: string
}

export const FormattedTime = memo<FormattedTimeProps>(
  ({ value, options, className }) => {
    const { formatTime } = useDateFormat()
    
    return <span className={className}>{formatTime(value, options)}</span>
  }
)
FormattedTime.displayName = 'FormattedTime'

// FormattedRelativeTime component
interface FormattedRelativeTimeProps {
  value: Date | string | number
  baseDate?: Date
  style?: 'distance' | 'relative'
  className?: string
}

export const FormattedRelativeTime = memo<FormattedRelativeTimeProps>(
  ({ value, baseDate, style = 'distance', className }) => {
    const { format, formatRelative } = useRelativeTime()
    
    const formattedValue = style === 'relative' 
      ? formatRelative(value, baseDate)
      : format(value, baseDate)
    
    return <span className={className}>{formattedValue}</span>
  }
)
FormattedRelativeTime.displayName = 'FormattedRelativeTime'

// FormattedDuration component
interface FormattedDurationProps {
  minutes: number
  className?: string
}

export const FormattedDuration = memo<FormattedDurationProps>(
  ({ minutes, className }) => {
    const { formatDuration } = useDateFormat()
    
    return <span className={className}>{formatDuration(minutes)}</span>
  }
)
FormattedDuration.displayName = 'FormattedDuration'

// FormattedList component
interface FormattedListProps {
  items: string[]
  options?: Intl.ListFormatOptions
  className?: string
  as?: 'span' | 'div' | 'p'
}

export const FormattedList = memo<FormattedListProps>(
  ({ items, options, className, as: Component = 'span' }) => {
    const { format } = useListFormat(options)
    
    return <Component className={className}>{format(items)}</Component>
  }
)
FormattedList.displayName = 'FormattedList'

// Compound component for more complex formatting scenarios
interface FormattedValueProps {
  children: React.ReactNode
  className?: string
  as?: keyof JSX.IntrinsicElements
}

export const FormattedValue = memo<FormattedValueProps>(
  ({ children, className, as: Component = 'span' }) => {
    return <Component className={className}>{children}</Component>
  }
)
FormattedValue.displayName = 'FormattedValue'

// Export a namespace with all components for easier imports
export const Formatted = {
  Number: FormattedNumber,
  Currency: FormattedCurrency,
  Percent: FormattedPercent,
  Date: FormattedDate,
  DateTime: FormattedDateTime,
  Time: FormattedTime,
  RelativeTime: FormattedRelativeTime,
  Duration: FormattedDuration,
  List: FormattedList,
  Value: FormattedValue,
}