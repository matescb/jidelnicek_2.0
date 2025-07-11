import React from 'react';
import { motion } from 'framer-motion';
import { Search, Package, FileX, Inbox, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  type?: 'search' | 'no-data' | 'error' | 'filtered';
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  suggestions?: string[];
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no-data',
  title,
  description,
  action,
  suggestions
}) => {
  const renderIllustration = () => {
    switch (type) {
      case 'search':
        return <SearchNotFoundAnimation />;
      case 'no-data':
        return <EmptyBoxAnimation />;
      case 'filtered':
        return <FilteredEmptyAnimation />;
      default:
        return <EmptyBoxAnimation />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        {renderIllustration()}
      </motion.div>

      <motion.h3
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2"
      >
        {title}
      </motion.h3>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-6"
      >
        {description}
      </motion.p>

      {suggestions && suggestions.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mb-6"
        >
          <p className="text-sm text-gray-500 dark:text-gray-500 mb-3">
            Try searching for:
          </p>
          <SuggestionsCarousel suggestions={suggestions} />
        </motion.div>
      )}

      {action && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        </motion.div>
      )}
    </div>
  );
};

const SearchNotFoundAnimation: React.FC = () => {
  return (
    <div className="relative w-32 h-32">
      <motion.div
        animate={{
          rotate: [0, 10, -10, 0],
          scale: [1, 1.1, 1]
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          repeatType: 'reverse'
        }}
      >
        <Search className="w-32 h-32 text-gray-300 dark:text-gray-700" />
      </motion.div>
      
      {/* Magnifying glass shine effect */}
      <motion.div
        className="absolute top-4 right-4 w-8 h-8 bg-white rounded-full opacity-30"
        animate={{
          scale: [0, 1, 0],
          opacity: [0, 0.5, 0]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          repeatDelay: 1
        }}
      />
      
      {/* Question marks floating around */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute text-2xl text-gray-400 dark:text-gray-600"
          style={{
            top: `${20 + i * 30}%`,
            left: `${10 + i * 40}%`
          }}
          animate={{
            y: [-10, 10, -10],
            opacity: [0, 1, 0],
            rotate: [0, 360]
          }}
          transition={{
            duration: 3,
            delay: i * 0.5,
            repeat: Infinity
          }}
        >
          ?
        </motion.div>
      ))}
    </div>
  );
};

const EmptyBoxAnimation: React.FC = () => {
  return (
    <div className="relative w-32 h-32">
      {/* Box base */}
      <motion.div
        className="absolute bottom-0 w-32 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"
        animate={{
          scale: [1, 0.95, 1]
        }}
        transition={{
          duration: 3,
          repeat: Infinity
        }}
      />
      
      {/* Box lid */}
      <motion.div
        className="absolute top-0 w-32 h-8 bg-gray-300 dark:bg-gray-600 rounded-t-lg origin-bottom"
        animate={{
          rotateX: [0, -20, 0]
        }}
        transition={{
          duration: 3,
          repeat: Infinity
        }}
      />
      
      {/* Dust particles */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-gray-400 rounded-full"
          style={{
            bottom: '50%',
            left: `${25 + i * 15}%`
          }}
          animate={{
            y: [-20, -40],
            opacity: [0, 1, 0],
            scale: [0, 1, 0]
          }}
          transition={{
            duration: 2,
            delay: i * 0.2,
            repeat: Infinity,
            repeatDelay: 1
          }}
        />
      ))}
    </div>
  );
};

const FilteredEmptyAnimation: React.FC = () => {
  return (
    <div className="relative w-32 h-32">
      <motion.div
        animate={{
          rotate: [0, 5, -5, 0]
        }}
        transition={{
          duration: 2,
          repeat: Infinity
        }}
      >
        <Filter className="w-32 h-32 text-gray-300 dark:text-gray-700" />
      </motion.div>
      
      {/* Items falling through filter */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 bg-blue-400 rounded-full"
          style={{
            top: 0,
            left: `${30 + i * 20}%`
          }}
          animate={{
            y: [0, 120],
            opacity: [1, 0],
            scale: [1, 0]
          }}
          transition={{
            duration: 1.5,
            delay: i * 0.3,
            repeat: Infinity
          }}
        />
      ))}
    </div>
  );
};

interface SuggestionsCarouselProps {
  suggestions: string[];
}

const SuggestionsCarousel: React.FC<SuggestionsCarouselProps> = ({ suggestions }) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {suggestions.map((suggestion, index) => (
        <motion.button
          key={suggestion}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          onClick={() => {
            // Handle suggestion click
            console.log('Clicked suggestion:', suggestion);
          }}
        >
          {suggestion}
        </motion.button>
      ))}
    </div>
  );
};

// No results illustration
export const NoResultsIllustration: React.FC = () => {
  return (
    <div className="relative w-48 h-48">
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        animate={{
          scale: [1, 1.05, 1],
          rotate: [0, 2, -2, 0]
        }}
        transition={{
          duration: 4,
          repeat: Infinity
        }}
      >
        <FileX className="w-24 h-24 text-gray-300 dark:text-gray-700" />
      </motion.div>
      
      {/* Tear drops */}
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-3 bg-blue-400 rounded-full"
          style={{
            top: '40%',
            left: i === 0 ? '35%' : '60%'
          }}
          animate={{
            y: [0, 30],
            opacity: [1, 0],
            scale: [1, 0.5]
          }}
          transition={{
            duration: 1,
            delay: i * 0.5,
            repeat: Infinity,
            repeatDelay: 2
          }}
        />
      ))}
    </div>
  );
};