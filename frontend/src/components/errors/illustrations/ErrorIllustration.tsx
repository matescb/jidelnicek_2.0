import React from 'react'
import { motion } from 'framer-motion'
import { useTheme } from '@/hooks/useTheme'

interface ErrorIllustrationProps {
  /**
   * Type of error illustration
   */
  type: '404' | '403' | '500' | 'offline' | 'maintenance' | 'empty' | 'search' | 'error' | 'timeout' | string
  /**
   * Additional CSS classes
   */
  className?: string
  /**
   * Enable animations
   */
  animated?: boolean
}

export const ErrorIllustration: React.FC<ErrorIllustrationProps> = ({
  type,
  className = '',
  animated = true
}) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const baseColors = {
    primary: isDark ? '#818cf8' : '#6366f1',
    secondary: isDark ? '#94a3b8' : '#64748b',
    error: isDark ? '#f87171' : '#ef4444',
    warning: isDark ? '#fbbf24' : '#f59e0b',
    success: isDark ? '#4ade80' : '#22c55e',
    background: isDark ? '#1e293b' : '#f1f5f9',
    surface: isDark ? '#334155' : '#e2e8f0',
    text: isDark ? '#f1f5f9' : '#1e293b'
  }

  const renderIllustration = () => {
    switch (type) {
      case '404':
        return <Error404Illustration colors={baseColors} animated={animated} />
      case '403':
        return <Error403Illustration colors={baseColors} animated={animated} />
      case '500':
        return <Error500Illustration colors={baseColors} animated={animated} />
      case 'offline':
        return <OfflineIllustration colors={baseColors} animated={animated} />
      case 'maintenance':
        return <MaintenanceIllustration colors={baseColors} animated={animated} />
      case 'empty':
        return <EmptyStateIllustration colors={baseColors} animated={animated} />
      case 'search':
        return <SearchEmptyIllustration colors={baseColors} animated={animated} />
      case 'timeout':
        return <TimeoutIllustration colors={baseColors} animated={animated} />
      case 'error':
      default:
        return <GenericErrorIllustration colors={baseColors} animated={animated} />
    }
  }

  return (
    <div className={`${className}`}>
      {renderIllustration()}
    </div>
  )
}

// 404 Illustration
const Error404Illustration: React.FC<{ colors: any; animated: boolean }> = ({ colors, animated }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    {/* Background circles */}
    <motion.circle
      cx="100"
      cy="100"
      r="90"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    />
    
    {/* Magnifying glass */}
    <motion.g
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <circle cx="85" cy="85" r="35" stroke={colors.primary} strokeWidth="6" fill="none" />
      <line x1="110" y1="110" x2="130" y2="130" stroke={colors.primary} strokeWidth="6" strokeLinecap="round" />
    </motion.g>
    
    {/* Question mark */}
    <motion.text
      x="85"
      y="95"
      textAnchor="middle"
      fontSize="40"
      fontWeight="bold"
      fill={colors.primary}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    >
      ?
    </motion.text>

    {animated && (
      <motion.circle
        cx="85"
        cy="85"
        r="35"
        stroke={colors.primary}
        strokeWidth="2"
        fill="none"
        strokeDasharray="5 5"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: '85px 85px' }}
      />
    )}
  </svg>
)

// 403 Illustration
const Error403Illustration: React.FC<{ colors: any; animated: boolean }> = ({ colors, animated }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <motion.circle
      cx="100"
      cy="100"
      r="90"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    />
    
    {/* Lock body */}
    <motion.rect
      x="70"
      y="90"
      width="60"
      height="45"
      rx="5"
      fill={colors.error}
      initial={{ y: 110, opacity: 0 }}
      animate={{ y: 90, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    />
    
    {/* Lock shackle */}
    <motion.path
      d="M85 90V75C85 66.7157 91.7157 60 100 60C108.284 60 115 66.7157 115 75V90"
      stroke={colors.error}
      strokeWidth="6"
      fill="none"
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ delay: 0.4, duration: 0.5 }}
    />
    
    {/* Keyhole */}
    <motion.circle
      cx="100"
      cy="107"
      r="5"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.6, duration: 0.3 }}
    />
    <motion.rect
      x="97"
      y="107"
      width="6"
      height="15"
      fill={colors.background}
      initial={{ height: 0 }}
      animate={{ height: 15 }}
      transition={{ delay: 0.7, duration: 0.3 }}
    />

    {animated && (
      <motion.g
        animate={{ rotate: [0, -5, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
        style={{ transformOrigin: '100px 100px' }}
      >
        <rect x="70" y="90" width="60" height="45" rx="5" fill={colors.error} opacity="0.3" />
      </motion.g>
    )}
  </svg>
)

// 500 Illustration
const Error500Illustration: React.FC<{ colors: any; animated: boolean }> = ({ colors, animated }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <motion.circle
      cx="100"
      cy="100"
      r="90"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    />
    
    {/* Server rack */}
    <motion.rect
      x="60"
      y="50"
      width="80"
      height="100"
      rx="5"
      fill={colors.surface}
      stroke={colors.secondary}
      strokeWidth="2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    />
    
    {/* Server slots */}
    {[0, 1, 2].map((i) => (
      <motion.g key={i} initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}>
        <rect x="70" y={65 + i * 25} width="60" height="15" rx="2" fill={colors.secondary} />
        <circle cx="80" cy={72.5 + i * 25} r="3" fill={i === 1 ? colors.error : colors.success} />
        <rect x="90" y={70 + i * 25} width="35" height="2" rx="1" fill={colors.text} opacity="0.3" />
      </motion.g>
    ))}
    
    {/* Error indicator */}
    <motion.g
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.6, duration: 0.3 }}
    >
      <circle cx="130" cy="70" r="15" fill={colors.error} />
      <text x="130" y="76" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">!</text>
    </motion.g>

    {animated && (
      <motion.circle
        cx="80"
        cy={97.5}
        r="3"
        fill={colors.error}
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    )}
  </svg>
)

// Offline Illustration
const OfflineIllustration: React.FC<{ colors: any; animated: boolean }> = ({ colors, animated }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <motion.circle
      cx="100"
      cy="100"
      r="90"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    />
    
    {/* WiFi base */}
    <motion.circle
      cx="100"
      cy="130"
      r="5"
      fill={colors.secondary}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.2, duration: 0.3 }}
    />
    
    {/* WiFi waves */}
    {[0, 1, 2].map((i) => (
      <motion.path
        key={i}
        d={`M ${85 - i * 10} ${120 - i * 10} Q 100 ${105 - i * 15} ${115 + i * 10} ${120 - i * 10}`}
        stroke={colors.secondary}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.5 }}
        transition={{ delay: 0.3 + i * 0.1, duration: 0.5 }}
      />
    ))}
    
    {/* X mark */}
    <motion.g
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
    >
      <line x1="80" y1="80" x2="120" y2="120" stroke={colors.error} strokeWidth="4" strokeLinecap="round" />
      <line x1="120" y1="80" x2="80" y2="120" stroke={colors.error} strokeWidth="4" strokeLinecap="round" />
    </motion.g>

    {animated && (
      <motion.g
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M ${85 - i * 10} ${120 - i * 10} Q 100 ${105 - i * 15} ${115 + i * 10} ${120 - i * 10}`}
            stroke={colors.secondary}
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
            opacity="0.3"
          />
        ))}
      </motion.g>
    )}
  </svg>
)

// Maintenance Illustration
const MaintenanceIllustration: React.FC<{ colors: any; animated: boolean }> = ({ colors, animated }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <motion.circle
      cx="100"
      cy="100"
      r="90"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    />
    
    {/* Gear */}
    <motion.g
      initial={{ rotate: 0 }}
      animate={{ rotate: animated ? 360 : 0 }}
      transition={{ duration: 10, repeat: animated ? Infinity : 0, ease: "linear" }}
      style={{ transformOrigin: '100px 100px' }}
    >
      <path
        d="M100 70 L105 80 L115 77 L117 87 L127 90 L125 100 L127 110 L117 113 L115 123 L105 120 L100 130 L95 120 L85 123 L83 113 L73 110 L75 100 L73 90 L83 87 L85 77 L95 80 Z"
        fill={colors.warning}
        stroke={colors.warning}
        strokeWidth="2"
      />
      <circle cx="100" cy="100" r="15" fill={colors.background} />
    </motion.g>
    
    {/* Wrench */}
    <motion.g
      initial={{ x: 30, y: -30, rotate: 45, opacity: 0 }}
      animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.7 }}
    >
      <path
        d="M85 95 L75 85 Q70 80 65 85 L60 90 L65 95 Q70 100 75 95 L85 105 L115 135 Q120 140 125 135 L130 130 Q135 125 130 120 L100 90 Z"
        fill={colors.secondary}
        stroke={colors.secondary}
        strokeWidth="1"
      />
    </motion.g>

    {animated && (
      <motion.circle
        cx="100"
        cy="100"
        r="30"
        stroke={colors.warning}
        strokeWidth="2"
        fill="none"
        strokeDasharray="5 5"
        initial={{ rotate: 0 }}
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: '100px 100px' }}
      />
    )}
  </svg>
)

// Empty State Illustration
const EmptyStateIllustration: React.FC<{ colors: any; animated: boolean }> = ({ colors, animated }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <motion.circle
      cx="100"
      cy="100"
      r="90"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    />
    
    {/* Box */}
    <motion.g
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    >
      <rect x="60" y="80" width="80" height="60" rx="5" fill={colors.surface} stroke={colors.secondary} strokeWidth="2" />
      <path d="M60 100 L100 120 L140 100" stroke={colors.secondary} strokeWidth="2" />
      <circle cx="100" cy="110" r="3" fill={colors.secondary} />
    </motion.g>
    
    {/* Papers flying out */}
    {animated && [0, 1, 2].map((i) => (
      <motion.rect
        key={i}
        x="90"
        y="70"
        width="20"
        height="25"
        rx="2"
        fill={colors.primary}
        opacity="0.6"
        initial={{ y: 90, rotate: 0, scale: 0 }}
        animate={{
          y: 40 - i * 10,
          x: 90 + (i - 1) * 20,
          rotate: (i - 1) * 15,
          scale: 1
        }}
        transition={{
          delay: 0.5 + i * 0.1,
          duration: 0.7,
          repeat: Infinity,
          repeatDelay: 3,
          repeatType: "reverse"
        }}
      />
    ))}
  </svg>
)

// Search Empty Illustration
const SearchEmptyIllustration: React.FC<{ colors: any; animated: boolean }> = ({ colors, animated }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <motion.circle
      cx="100"
      cy="100"
      r="90"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    />
    
    {/* Documents */}
    {[0, 1, 2].map((i) => (
      <motion.rect
        key={i}
        x={70 + i * 15}
        y={60 + i * 5}
        width="50"
        height="70"
        rx="3"
        fill={colors.surface}
        stroke={colors.secondary}
        strokeWidth="1"
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1 - i * 0.2, x: 70 + i * 15 }}
        transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
      />
    ))}
    
    {/* Magnifying glass */}
    <motion.g
      initial={{ scale: 0, rotate: -45 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
    >
      <circle cx="115" cy="115" r="25" stroke={colors.primary} strokeWidth="4" fill="white" fillOpacity="0.9" />
      <line x1="133" y1="133" x2="145" y2="145" stroke={colors.primary} strokeWidth="4" strokeLinecap="round" />
      {/* X mark inside magnifying glass */}
      <g>
        <line x1="105" y1="105" x2="125" y2="125" stroke={colors.error} strokeWidth="3" strokeLinecap="round" />
        <line x1="125" y1="105" x2="105" y2="125" stroke={colors.error} strokeWidth="3" strokeLinecap="round" />
      </g>
    </motion.g>

    {animated && (
      <motion.circle
        cx="115"
        cy="115"
        r="25"
        stroke={colors.primary}
        strokeWidth="2"
        fill="none"
        strokeDasharray="3 3"
        initial={{ rotate: 0 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: '115px 115px' }}
      />
    )}
  </svg>
)

// Timeout Illustration
const TimeoutIllustration: React.FC<{ colors: any; animated: boolean }> = ({ colors, animated }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <motion.circle
      cx="100"
      cy="100"
      r="90"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    />
    
    {/* Clock face */}
    <motion.circle
      cx="100"
      cy="100"
      r="50"
      fill={colors.surface}
      stroke={colors.secondary}
      strokeWidth="3"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.2, duration: 0.5 }}
    />
    
    {/* Clock marks */}
    {[0, 3, 6, 9].map((hour) => (
      <motion.line
        key={hour}
        x1="100"
        y1="55"
        x2="100"
        y2="60"
        stroke={colors.text}
        strokeWidth="2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 + hour * 0.05, duration: 0.3 }}
        style={{
          transform: `rotate(${hour * 30}deg)`,
          transformOrigin: '100px 100px'
        }}
      />
    ))}
    
    {/* Clock hands */}
    <motion.line
      x1="100"
      y1="100"
      x2="100"
      y2="75"
      stroke={colors.text}
      strokeWidth="3"
      strokeLinecap="round"
      initial={{ rotate: 0 }}
      animate={{ rotate: animated ? 360 : 90 }}
      transition={{ duration: animated ? 2 : 0.5, repeat: animated ? Infinity : 0, ease: "linear" }}
      style={{ transformOrigin: '100px 100px' }}
    />
    <motion.line
      x1="100"
      y1="100"
      x2="100"
      y2="65"
      stroke={colors.text}
      strokeWidth="2"
      strokeLinecap="round"
      initial={{ rotate: 0 }}
      animate={{ rotate: animated ? 4320 : 180 }}
      transition={{ duration: animated ? 2 : 0.5, repeat: animated ? Infinity : 0, ease: "linear" }}
      style={{ transformOrigin: '100px 100px' }}
    />
    
    {/* Center dot */}
    <circle cx="100" cy="100" r="4" fill={colors.text} />
    
    {/* Warning sign */}
    <motion.g
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.6, duration: 0.3 }}
    >
      <circle cx="130" cy="130" r="15" fill={colors.warning} />
      <text x="130" y="136" textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">!</text>
    </motion.g>
  </svg>
)

// Generic Error Illustration
const GenericErrorIllustration: React.FC<{ colors: any; animated: boolean }> = ({ colors, animated }) => (
  <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
    <motion.circle
      cx="100"
      cy="100"
      r="90"
      fill={colors.background}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.5 }}
    />
    
    {/* Warning triangle */}
    <motion.path
      d="M100 50 L140 130 L60 130 Z"
      fill={colors.error}
      stroke={colors.error}
      strokeWidth="2"
      strokeLinejoin="round"
      initial={{ scale: 0, rotate: 180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      style={{ transformOrigin: '100px 100px' }}
    />
    
    {/* Exclamation mark */}
    <motion.g
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.3 }}
    >
      <rect x="97" y="75" width="6" height="30" rx="3" fill="white" />
      <circle cx="100" cy="115" r="4" fill="white" />
    </motion.g>

    {animated && (
      <motion.path
        d="M100 50 L140 130 L60 130 Z"
        fill="none"
        stroke={colors.error}
        strokeWidth="2"
        strokeLinejoin="round"
        opacity="0.3"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ transformOrigin: '100px 100px' }}
      />
    )}
  </svg>
)