import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Direction, 
  getDirection, 
  updateDocumentDirection, 
  updateRTLCSSVariables 
} from '@/i18n/rtl'

interface DirectionalContextValue {
  direction: Direction
  isRTL: boolean
  toggleDirection: () => void
  setDirection: (direction: Direction) => void
}

const DirectionalContext = createContext<DirectionalContextValue | undefined>(undefined)

export const useDirection = () => {
  const context = useContext(DirectionalContext)
  if (!context) {
    throw new Error('useDirection must be used within DirectionalProvider')
  }
  return context
}

interface DirectionalProviderProps {
  children: ReactNode
  forceDirection?: Direction
}

export const DirectionalProvider: React.FC<DirectionalProviderProps> = ({ 
  children, 
  forceDirection 
}) => {
  const { i18n } = useTranslation()
  const [direction, setDirectionState] = useState<Direction>(() => {
    if (forceDirection) return forceDirection
    return getDirection(i18n.language)
  })

  const isRTL = direction === 'rtl'

  // Update direction when language changes
  useEffect(() => {
    if (!forceDirection) {
      const newDirection = getDirection(i18n.language)
      setDirectionState(newDirection)
    }
  }, [i18n.language, forceDirection])

  // Update document direction when direction changes
  useEffect(() => {
    updateDocumentDirection(direction)
    updateRTLCSSVariables(direction)
  }, [direction])

  const toggleDirection = () => {
    setDirectionState(prev => prev === 'ltr' ? 'rtl' : 'ltr')
  }

  const setDirection = (newDirection: Direction) => {
    setDirectionState(newDirection)
  }

  const value: DirectionalContextValue = {
    direction,
    isRTL,
    toggleDirection,
    setDirection,
  }

  return (
    <DirectionalContext.Provider value={value}>
      {children}
    </DirectionalContext.Provider>
  )
}