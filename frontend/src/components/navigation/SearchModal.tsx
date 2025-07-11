import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, Combobox, Transition } from '@headlessui/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch,
  FiX,
  FiClock,
  FiTrendingUp,
  FiBook,
  FiShoppingCart,
  FiCalendar,
  FiMic,
  FiArrowRight,
} from 'react-icons/fi';
import { useScreenSize } from './NavigationContext';
import { cn } from '../../lib/utils';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  category: 'recipe' | 'shopping' | 'meal-plan' | 'page';
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const mockSearchResults: SearchResult[] = [
  {
    id: '1',
    title: 'Spaghetti Carbonara',
    description: 'Classic Italian pasta dish',
    category: 'recipe',
    path: '/recipes/1',
    icon: FiBook,
  },
  {
    id: '2',
    title: 'Weekly Grocery List',
    description: 'Your saved shopping list',
    category: 'shopping',
    path: '/shopping/lists/1',
    icon: FiShoppingCart,
  },
  {
    id: '3',
    title: 'Meal Plan - Week 45',
    description: 'This week\'s meal plan',
    category: 'meal-plan',
    path: '/meal-plans/current',
    icon: FiCalendar,
  },
];

const recentSearches = [
  'Chicken recipes',
  'Low carb meals',
  'Quick dinner ideas',
  'Vegetarian options',
];

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMobile } = useScreenSize();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // This would be handled by the parent component
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Mock search function
  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length > 0) {
      const filtered = mockSearchResults.filter(
        (result) =>
          result.title.toLowerCase().includes(value.toLowerCase()) ||
          result.description?.toLowerCase().includes(value.toLowerCase())
      );
      setResults(filtered);
    } else {
      setResults([]);
    }
  };

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    onClose();
    // Save to recent searches
    const searches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
    const updated = [query, ...searches.filter((s: string) => s !== query)].slice(0, 5);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleVoiceSearch = () => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSearch(transcript);
      };

      recognition.start();
    } else {
      alert('Voice search is not supported in your browser.');
    }
  };

  return (
    <Transition.Root show={isOpen} as={React.Fragment} afterLeave={() => setQuery('')}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={onClose}
      >
        <Transition.Child
          as={React.Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto p-4 sm:p-6 md:p-20">
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel
              className={cn(
                'mx-auto transform divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden rounded-xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black ring-opacity-5 transition-all',
                isMobile ? 'max-w-full h-full' : 'max-w-2xl'
              )}
            >
              <Combobox onChange={handleSelect}>
                <div className="relative">
                  <FiSearch
                    className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                  <Combobox.Input
                    ref={inputRef}
                    className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                    placeholder={t('search.placeholder')}
                    value={query}
                    onChange={(event) => handleSearch(event.target.value)}
                  />
                  
                  {/* Voice Search Button */}
                  <button
                    onClick={handleVoiceSearch}
                    className={cn(
                      'absolute right-12 top-3 p-1.5 rounded-md transition-colors',
                      isListening
                        ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400'
                    )}
                    aria-label={t('search.voiceSearch')}
                  >
                    <FiMic className="h-4 w-4" />
                  </button>

                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="absolute right-3 top-3 p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400"
                    aria-label={t('common.close')}
                  >
                    <FiX className="h-4 w-4" />
                  </button>
                </div>

                {/* Search Results */}
                <Combobox.Options
                  static
                  className="max-h-96 scroll-py-3 overflow-y-auto p-3"
                >
                  {query === '' && (
                    <>
                      {/* Recent Searches */}
                      <div className="mb-4">
                        <h3 className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {t('search.recent')}
                        </h3>
                        {recentSearches.map((search, index) => (
                          <button
                            key={index}
                            onClick={() => handleSearch(search)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            <FiClock className="h-4 w-4 text-gray-400" />
                            <span>{search}</span>
                          </button>
                        ))}
                      </div>

                      {/* Trending */}
                      <div>
                        <h3 className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {t('search.trending')}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {['Healthy', 'Quick', 'Vegetarian', 'Budget'].map((tag) => (
                            <button
                              key={tag}
                              onClick={() => handleSearch(tag)}
                              className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-700 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                            >
                              <FiTrendingUp className="h-3 w-3" />
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {query !== '' && results.length === 0 && (
                    <div className="py-14 px-6 text-center text-sm sm:px-14">
                      <FiSearch
                        className="mx-auto h-6 w-6 text-gray-400"
                        aria-hidden="true"
                      />
                      <p className="mt-4 font-semibold text-gray-900 dark:text-gray-100">
                        {t('search.noResults')}
                      </p>
                      <p className="mt-2 text-gray-500 dark:text-gray-400">
                        {t('search.tryDifferent')}
                      </p>
                    </div>
                  )}

                  {results.length > 0 && (
                    <div className="space-y-2">
                      {results.map((result) => (
                        <Combobox.Option
                          key={result.id}
                          value={result}
                          as={React.Fragment}
                        >
                          {({ active }) => (
                            <motion.div
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              className={cn(
                                'flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2',
                                active
                                  ? 'bg-primary-50 dark:bg-primary-900/20'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                              )}
                            >
                              {result.icon && (
                                <result.icon
                                  className={cn(
                                    'h-5 w-5',
                                    active
                                      ? 'text-primary-600 dark:text-primary-400'
                                      : 'text-gray-400'
                                  )}
                                />
                              )}
                              <div className="flex-1 text-left">
                                <p
                                  className={cn(
                                    'text-sm font-medium',
                                    active
                                      ? 'text-primary-900 dark:text-primary-100'
                                      : 'text-gray-900 dark:text-gray-100'
                                  )}
                                >
                                  {result.title}
                                </p>
                                {result.description && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {result.description}
                                  </p>
                                )}
                              </div>
                              <FiArrowRight
                                className={cn(
                                  'h-4 w-4',
                                  active
                                    ? 'text-primary-600 dark:text-primary-400'
                                    : 'text-gray-400'
                                )}
                              />
                            </motion.div>
                          )}
                        </Combobox.Option>
                      ))}
                    </div>
                  )}
                </Combobox.Options>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-xs font-semibold">
                        ↑↓
                      </kbd>
                      {t('search.navigate')}
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-xs font-semibold">
                        ↵
                      </kbd>
                      {t('search.select')}
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 text-xs font-semibold">
                        ESC
                      </kbd>
                      {t('search.close')}
                    </span>
                  </div>
                  {!isMobile && (
                    <span>
                      {t('search.poweredBy')} AI Search
                    </span>
                  )}
                </div>
              </Combobox>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
};