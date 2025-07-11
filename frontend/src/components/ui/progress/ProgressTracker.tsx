import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { cn } from '../../../utils/cn';
import { ProgressBar } from './ProgressBar';

export interface ProgressItem {
  id: string;
  name: string;
  progress: number;
  category?: string;
  timeEstimate?: string;
  status?: 'pending' | 'in-progress' | 'completed' | 'error';
  children?: ProgressItem[];
}

interface ProgressTrackerProps {
  items: ProgressItem[];
  title?: string;
  showOverall?: boolean;
  expandable?: boolean;
  groupByCategory?: boolean;
  className?: string;
}

const statusVariants = {
  pending: 'primary',
  'in-progress': 'primary',
  completed: 'success',
  error: 'error',
} as const;

export const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  items,
  title,
  showOverall = true,
  expandable = true,
  groupByCategory = false,
  className,
}) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  );

  const toggleItem = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const calculateOverallProgress = (items: ProgressItem[]): number => {
    const flattenItems = (items: ProgressItem[]): ProgressItem[] => {
      return items.reduce((acc, item) => {
        acc.push(item);
        if (item.children) {
          acc.push(...flattenItems(item.children));
        }
        return acc;
      }, [] as ProgressItem[]);
    };

    const allItems = flattenItems(items);
    const totalProgress = allItems.reduce((sum, item) => sum + item.progress, 0);
    return Math.round(totalProgress / allItems.length);
  };

  const renderProgressItem = (item: ProgressItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.id);

    return (
      <div key={item.id} className={cn('mb-3', level > 0 && 'ml-6')}>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1">
              {hasChildren && expandable && (
                <button
                  onClick={() => toggleItem(item.id)}
                  className="p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              )}
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {item.name}
              </span>
              {item.timeEstimate && (
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <Clock className="w-3 h-3 mr-1" />
                  {item.timeEstimate}
                </div>
              )}
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-4">
              {item.progress}%
            </span>
          </div>
          
          <ProgressBar
            value={item.progress}
            variant={statusVariants[item.status || 'in-progress']}
            size="sm"
            animated
            striped={item.status === 'in-progress'}
          />
        </div>

        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3">
                {item.children.map(child => renderProgressItem(child, level + 1))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderGroupedItems = () => {
    const grouped = items.reduce((acc, item) => {
      const category = item.category || 'Uncategorized';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {} as Record<string, ProgressItem[]>);

    return Object.entries(grouped).map(([category, categoryItems]) => {
      const isExpanded = expandedCategories.has(category);
      const categoryProgress = calculateOverallProgress(categoryItems);

      return (
        <div key={category} className="mb-6">
          <div
            className="flex items-center justify-between mb-3 cursor-pointer"
            onClick={() => toggleCategory(category)}
          >
            <div className="flex items-center space-x-2">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {category}
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({categoryItems.length} items)
              </span>
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {categoryProgress}%
            </span>
          </div>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {categoryItems.map(item => renderProgressItem(item))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });
  };

  const overallProgress = calculateOverallProgress(items);

  return (
    <div className={cn('space-y-4', className)}>
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
      )}

      {showOverall && (
        <div className="mb-6">
          <ProgressBar
            value={overallProgress}
            label="Overall Progress"
            showPercentage
            size="lg"
            variant="primary"
            animated
          />
        </div>
      )}

      {groupByCategory ? renderGroupedItems() : items.map(item => renderProgressItem(item))}
    </div>
  );
};