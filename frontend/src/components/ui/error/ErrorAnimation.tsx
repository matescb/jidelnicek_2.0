import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, XCircle, WifiOff, Search } from 'lucide-react';

interface ErrorAnimationProps {
  type?: 'error' | 'warning' | 'offline' | '404' | 'glitch';
  size?: 'sm' | 'md' | 'lg';
}

export const ErrorAnimation: React.FC<ErrorAnimationProps> = ({ 
  type = 'error', 
  size = 'md' 
}) => {
  const sizeMap = {
    sm: 48,
    md: 96,
    lg: 144
  };

  const iconSize = sizeMap[size];

  const renderAnimation = () => {
    switch (type) {
      case 'error':
        return (
          <motion.div
            initial={{ scale: 0, rotate: 0 }}
            animate={{ 
              scale: [0, 1.2, 1],
              rotate: [0, -10, 10, -10, 0]
            }}
            transition={{ 
              duration: 0.5,
              times: [0, 0.5, 0.6, 0.8, 1]
            }}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                opacity: [1, 0.8, 1]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse'
              }}
            >
              <XCircle size={iconSize} className="text-red-500" />
            </motion.div>
          </motion.div>
        );

      case 'warning':
        return (
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <motion.div
              animate={{ 
                rotate: [0, -5, 5, -5, 0],
                scale: [1, 1.05, 1]
              }}
              transition={{ 
                duration: 0.5,
                repeat: Infinity,
                repeatDelay: 2
              }}
            >
              <AlertTriangle size={iconSize} className="text-yellow-500" />
              <motion.div
                className="absolute inset-0 bg-yellow-500 rounded-full"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ 
                  scale: 1.5,
                  opacity: 0
                }}
                transition={{ 
                  duration: 1,
                  repeat: Infinity,
                  repeatDelay: 2
                }}
              />
            </motion.div>
          </motion.div>
        );

      case 'offline':
        return (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                opacity: [1, 0.5, 1]
              }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                repeatType: 'reverse'
              }}
            >
              <WifiOff size={iconSize} className="text-gray-500" />
            </motion.div>
            <motion.div
              className="absolute bottom-0 w-full h-1 bg-gray-400"
              animate={{ 
                scaleX: [0, 1, 0],
                originX: 0
              }}
              transition={{ 
                duration: 3,
                repeat: Infinity
              }}
            />
          </motion.div>
        );

      case '404':
        return (
          <motion.div className="relative">
            <motion.div
              className="text-8xl font-bold text-gray-300"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              404
            </motion.div>
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.div
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 0.8, 1]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity
                }}
              >
                <Search size={iconSize / 2} className="text-gray-400" />
              </motion.div>
            </motion.div>
          </motion.div>
        );

      case 'glitch':
        return (
          <motion.div className="relative">
            <motion.div
              className="absolute inset-0"
              animate={{ 
                x: [-2, 2, -2, 0],
                opacity: [1, 0.8, 1, 1],
                filter: ['hue-rotate(0deg)', 'hue-rotate(90deg)', 'hue-rotate(-90deg)', 'hue-rotate(0deg)']
              }}
              transition={{ 
                duration: 0.2,
                repeat: Infinity,
                repeatDelay: 3
              }}
            >
              <XCircle size={iconSize} className="text-red-500" />
            </motion.div>
            <motion.div
              className="absolute inset-0"
              animate={{ 
                x: [2, -2, 2, 0],
                opacity: [0.5, 0.3, 0.5, 0],
                filter: ['hue-rotate(180deg)', 'hue-rotate(270deg)', 'hue-rotate(90deg)', 'hue-rotate(0deg)']
              }}
              transition={{ 
                duration: 0.2,
                repeat: Infinity,
                repeatDelay: 3
              }}
            >
              <XCircle size={iconSize} className="text-cyan-500" />
            </motion.div>
            <XCircle size={iconSize} className="text-red-500 relative z-10" />
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <AnimatePresence mode="wait">
        {renderAnimation()}
      </AnimatePresence>
    </div>
  );
};

// Animated broken connection
export const BrokenConnectionAnimation: React.FC = () => {
  return (
    <motion.div className="relative w-32 h-32">
      <motion.div
        className="absolute left-0 top-1/2 w-12 h-12 bg-gray-400 rounded-full"
        animate={{ 
          x: [0, 10, 0],
          scale: [1, 0.9, 1]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity
        }}
      />
      <motion.div
        className="absolute right-0 top-1/2 w-12 h-12 bg-gray-400 rounded-full"
        animate={{ 
          x: [0, -10, 0],
          scale: [1, 0.9, 1]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity
        }}
      />
      <motion.div
        className="absolute left-12 top-1/2 w-8 h-1 bg-gray-400 origin-left"
        animate={{ 
          scaleX: [1, 0.5, 1],
          opacity: [1, 0.5, 1]
        }}
        transition={{ 
          duration: 1,
          repeat: Infinity
        }}
      />
      <motion.div
        className="absolute right-12 top-1/2 w-8 h-1 bg-gray-400 origin-right"
        animate={{ 
          scaleX: [1, 0.5, 1],
          opacity: [1, 0.5, 1]
        }}
        transition={{ 
          duration: 1,
          repeat: Infinity
        }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        animate={{ 
          scale: [0, 1, 0],
          rotate: [0, 180, 360]
        }}
        transition={{ 
          duration: 2,
          repeat: Infinity
        }}
      >
        <XCircle size={24} className="text-red-500" />
      </motion.div>
    </motion.div>
  );
};