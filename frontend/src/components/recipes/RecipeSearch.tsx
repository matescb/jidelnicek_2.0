import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
  Grid,
  List,
  Save,
  History,
  Star,
  Clock,
  Users,
  ChefHat,
  Bookmark,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRecipeStore } from '../../stores/recipeStore';
import { useDebounce } from '../../hooks/useDebounce';
import { Recipe, DietaryRestriction, RecipeCategory, DifficultyLevel } from '../../types/recipe';

// Types
interface FilterState {
  categories: RecipeCategory[];
  difficulty: DifficultyLevel[];
  dietary: DietaryRestriction[];
  prepTimeRange: [number, number];
  cookTimeRange: [number, number];
  totalTimeRange: [number, number];
  servingsRange: [number, number];
  includedIngredients: string[];
  excludedIngredients: string[];
  authors: string[];
  ratingRange: [number, number];
}

interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: Date;
}

type SortOption = 'newest' | 'oldest' | 'popular' | 'rating' | 'prepTime' | 'cookTime' | 'title';
type ViewMode = 'grid' | 'list';

const initialFilterState: FilterState = {
  categories: [],
  difficulty: [],
  dietary: [],
  prepTimeRange: [0, 240],
  cookTimeRange: [0, 480],
  totalTimeRange: [0, 720],
  servingsRange: [1, 20],
  includedIngredients: [],
  excludedIngredients: [],
  authors: [],
  ratingRange: [0, 5],
};

const categoryOptions: RecipeCategory[] = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'appetizer',
  'beverage',
  'salad',
  'soup',
  'main',
  'side',
];

const difficultyOptions: DifficultyLevel[] = ['easy', 'medium', 'hard'];

const dietaryOptions: DietaryRestriction[] = [
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'low-carb',
  'keto',
  'paleo',
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'prepTime', label: 'Prep Time (Low to High)' },
  { value: 'cookTime', label: 'Cook Time (Low to High)' },
  { value: 'title', label: 'Alphabetical' },
];

export const RecipeSearch: React.FC = () => {
  const { recipes, searchRecipes, loading } = useRecipeStore();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterPresets, setFilterPresets] = useState<FilterPreset[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [ingredientInput, setIngredientInput] = useState('');
  const [excludeIngredientInput, setExcludeIngredientInput] = useState('');
  
  // Debounced search
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Load saved data from localStorage
  useEffect(() => {
    const savedPresets = localStorage.getItem('recipeFilterPresets');
    if (savedPresets) {
      setFilterPresets(JSON.parse(savedPresets));
    }
    
    const savedHistory = localStorage.getItem('recipeSearchHistory');
    if (savedHistory) {
      setSearchHistory(JSON.parse(savedHistory));
    }
    
    const savedViewMode = localStorage.getItem('recipeViewMode');
    if (savedViewMode) {
      setViewMode(savedViewMode as ViewMode);
    }
  }, []);
  
  // Save search history
  const addToSearchHistory = useCallback((query: string) => {
    if (!query.trim()) return;
    
    const newHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('recipeSearchHistory', JSON.stringify(newHistory));
  }, [searchHistory]);
  
  // Search effect
  useEffect(() => {
    if (debouncedSearchQuery) {
      addToSearchHistory(debouncedSearchQuery);
    }
    searchRecipes(debouncedSearchQuery, filters, sortBy);
  }, [debouncedSearchQuery, filters, sortBy, searchRecipes, addToSearchHistory]);
  
  // Filter helpers
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.categories.length > 0) count++;
    if (filters.difficulty.length > 0) count++;
    if (filters.dietary.length > 0) count++;
    if (filters.prepTimeRange[0] > 0 || filters.prepTimeRange[1] < 240) count++;
    if (filters.cookTimeRange[0] > 0 || filters.cookTimeRange[1] < 480) count++;
    if (filters.totalTimeRange[0] > 0 || filters.totalTimeRange[1] < 720) count++;
    if (filters.servingsRange[0] > 1 || filters.servingsRange[1] < 20) count++;
    if (filters.includedIngredients.length > 0) count++;
    if (filters.excludedIngredients.length > 0) count++;
    if (filters.authors.length > 0) count++;
    if (filters.ratingRange[0] > 0 || filters.ratingRange[1] < 5) count++;
    return count;
  }, [filters]);
  
  const hasActiveFilters = activeFilterCount > 0;
  
  // Handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setShowSearchSuggestions(true);
  };
  
  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSearchSuggestions(false);
  };
  
  const handleSearchSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSearchSuggestions(false);
  };
  
  const handleFilterChange = <K extends keyof FilterState>(
    key: K,
    value: FilterState[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };
  
  const handleClearAllFilters = () => {
    setFilters(initialFilterState);
  };
  
  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName,
      filters: { ...filters },
      createdAt: new Date(),
    };
    
    const updatedPresets = [...filterPresets, newPreset];
    setFilterPresets(updatedPresets);
    localStorage.setItem('recipeFilterPresets', JSON.stringify(updatedPresets));
    
    setPresetName('');
    setShowPresetModal(false);
  };
  
  const handleLoadPreset = (preset: FilterPreset) => {
    setFilters(preset.filters);
  };
  
  const handleDeletePreset = (presetId: string) => {
    const updatedPresets = filterPresets.filter(p => p.id !== presetId);
    setFilterPresets(updatedPresets);
    localStorage.setItem('recipeFilterPresets', JSON.stringify(updatedPresets));
  };
  
  const handleAddIngredient = (included: boolean) => {
    const input = included ? ingredientInput : excludeIngredientInput;
    if (!input.trim()) return;
    
    if (included) {
      handleFilterChange('includedIngredients', [...filters.includedIngredients, input]);
      setIngredientInput('');
    } else {
      handleFilterChange('excludedIngredients', [...filters.excludedIngredients, input]);
      setExcludeIngredientInput('');
    }
  };
  
  const handleRemoveIngredient = (ingredient: string, included: boolean) => {
    if (included) {
      handleFilterChange(
        'includedIngredients',
        filters.includedIngredients.filter(i => i !== ingredient)
      );
    } else {
      handleFilterChange(
        'excludedIngredients',
        filters.excludedIngredients.filter(i => i !== ingredient)
      );
    }
  };
  
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('recipeViewMode', mode);
  };
  
  // Render helpers
  const renderSearchSuggestions = () => {
    const suggestions = searchHistory.filter(h =>
      h.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (!showSearchSuggestions || suggestions.length === 0) return null;
    
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-10"
      >
        <div className="p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 flex items-center gap-1">
            <History className="w-3 h-3" />
            Recent searches
          </div>
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSearchSuggestionClick(suggestion)}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </motion.div>
    );
  };
  
  const renderFilterChips = () => {
    const chips: { label: string; onRemove: () => void }[] = [];
    
    filters.categories.forEach(cat => {
      chips.push({
        label: cat,
        onRemove: () => handleFilterChange('categories', filters.categories.filter(c => c !== cat)),
      });
    });
    
    filters.difficulty.forEach(diff => {
      chips.push({
        label: diff,
        onRemove: () => handleFilterChange('difficulty', filters.difficulty.filter(d => d !== diff)),
      });
    });
    
    filters.dietary.forEach(diet => {
      chips.push({
        label: diet,
        onRemove: () => handleFilterChange('dietary', filters.dietary.filter(d => d !== diet)),
      });
    });
    
    if (chips.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((chip, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded-full text-sm"
          >
            <span>{chip.label}</span>
            <button
              onClick={chip.onRemove}
              className="hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
        {hasActiveFilters && (
          <button
            onClick={handleClearAllFilters}
            className="flex items-center gap-1 px-3 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors text-sm"
          >
            <RotateCcw className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>
    );
  };
  
  const renderFilters = () => (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 mb-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Categories */}
        <div>
          <label className="block text-sm font-medium mb-2">Categories</label>
          <div className="space-y-2">
            {categoryOptions.map(cat => (
              <label key={cat} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.categories.includes(cat)}
                  onChange={e => {
                    if (e.target.checked) {
                      handleFilterChange('categories', [...filters.categories, cat]);
                    } else {
                      handleFilterChange('categories', filters.categories.filter(c => c !== cat));
                    }
                  }}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="capitalize">{cat}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Difficulty */}
        <div>
          <label className="block text-sm font-medium mb-2">Difficulty</label>
          <div className="space-y-2">
            {difficultyOptions.map(diff => (
              <label key={diff} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.difficulty.includes(diff)}
                  onChange={e => {
                    if (e.target.checked) {
                      handleFilterChange('difficulty', [...filters.difficulty, diff]);
                    } else {
                      handleFilterChange('difficulty', filters.difficulty.filter(d => d !== diff));
                    }
                  }}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="capitalize">{diff}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Dietary Restrictions */}
        <div>
          <label className="block text-sm font-medium mb-2">Dietary Restrictions</label>
          <div className="space-y-2">
            {dietaryOptions.map(diet => (
              <label key={diet} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.dietary.includes(diet)}
                  onChange={e => {
                    if (e.target.checked) {
                      handleFilterChange('dietary', [...filters.dietary, diet]);
                    } else {
                      handleFilterChange('dietary', filters.dietary.filter(d => d !== diet));
                    }
                  }}
                  className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="capitalize">{diet.replace('-', ' ')}</span>
              </label>
            ))}
          </div>
        </div>
        
        {/* Time Ranges */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Prep Time: {filters.prepTimeRange[0]} - {filters.prepTimeRange[1]} min
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="240"
              value={filters.prepTimeRange[0]}
              onChange={e => handleFilterChange('prepTimeRange', [parseInt(e.target.value), filters.prepTimeRange[1]])}
              className="flex-1"
            />
            <input
              type="range"
              min="0"
              max="240"
              value={filters.prepTimeRange[1]}
              onChange={e => handleFilterChange('prepTimeRange', [filters.prepTimeRange[0], parseInt(e.target.value)])}
              className="flex-1"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Cook Time: {filters.cookTimeRange[0]} - {filters.cookTimeRange[1]} min
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="480"
              value={filters.cookTimeRange[0]}
              onChange={e => handleFilterChange('cookTimeRange', [parseInt(e.target.value), filters.cookTimeRange[1]])}
              className="flex-1"
            />
            <input
              type="range"
              min="0"
              max="480"
              value={filters.cookTimeRange[1]}
              onChange={e => handleFilterChange('cookTimeRange', [filters.cookTimeRange[0], parseInt(e.target.value)])}
              className="flex-1"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">
            Servings: {filters.servingsRange[0]} - {filters.servingsRange[1]}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="20"
              value={filters.servingsRange[0]}
              onChange={e => handleFilterChange('servingsRange', [parseInt(e.target.value), filters.servingsRange[1]])}
              className="flex-1"
            />
            <input
              type="range"
              min="1"
              max="20"
              value={filters.servingsRange[1]}
              onChange={e => handleFilterChange('servingsRange', [filters.servingsRange[0], parseInt(e.target.value)])}
              className="flex-1"
            />
          </div>
        </div>
        
        {/* Ingredients */}
        <div>
          <label className="block text-sm font-medium mb-2">Include Ingredients</label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={ingredientInput}
                onChange={e => setIngredientInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddIngredient(true)}
                placeholder="Add ingredient..."
                className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              />
              <button
                onClick={() => handleAddIngredient(true)}
                className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {filters.includedIngredients.map((ing, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs"
                >
                  {ing}
                  <button onClick={() => handleRemoveIngredient(ing, true)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Exclude Ingredients</label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={excludeIngredientInput}
                onChange={e => setExcludeIngredientInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleAddIngredient(false)}
                placeholder="Add ingredient..."
                className="flex-1 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
              />
              <button
                onClick={() => handleAddIngredient(false)}
                className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {filters.excludedIngredients.map((ing, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full text-xs"
                >
                  {ing}
                  <button onClick={() => handleRemoveIngredient(ing, false)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Rating: {filters.ratingRange[0]} - {filters.ratingRange[1]} stars
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={filters.ratingRange[0]}
              onChange={e => handleFilterChange('ratingRange', [parseFloat(e.target.value), filters.ratingRange[1]])}
              className="flex-1"
            />
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={filters.ratingRange[1]}
              onChange={e => handleFilterChange('ratingRange', [filters.ratingRange[0], parseFloat(e.target.value)])}
              className="flex-1"
            />
          </div>
        </div>
      </div>
      
      {/* Filter Presets */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Filter Presets</h3>
          <button
            onClick={() => setShowPresetModal(true)}
            className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm"
          >
            <Save className="w-3 h-3" />
            Save Current
          </button>
        </div>
        
        {filterPresets.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filterPresets.map(preset => (
              <div
                key={preset.id}
                className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600"
              >
                <button
                  onClick={() => handleLoadPreset(preset)}
                  className="flex-1 text-left text-sm hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {preset.name}
                </button>
                <button
                  onClick={() => handleDeletePreset(preset.id)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No saved presets</p>
        )}
      </div>
    </motion.div>
  );
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Bar */}
      <div className="relative mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => setShowSearchSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
            placeholder="Search recipes..."
            className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        
        <AnimatePresence>{renderSearchSuggestions()}</AnimatePresence>
      </div>
      
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showFilters
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white text-indigo-600 rounded-full text-xs">
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {sortOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleViewModeChange('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleViewModeChange('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <AnimatePresence>
        {showFilters && renderFilters()}
      </AnimatePresence>
      
      {/* Filter Chips */}
      {renderFilterChips()}
      
      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
          {/* Recipe items would be rendered here based on the search results */}
          {recipes.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No recipes found matching your criteria</p>
            </div>
          ) : (
            <p className="col-span-full text-center text-gray-500">
              Recipe results would be displayed here
            </p>
          )}
        </div>
      )}
      
      {/* Save Preset Modal */}
      <AnimatePresence>
        {showPresetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowPresetModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-lg font-semibold mb-4">Save Filter Preset</h3>
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="Preset name..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowPresetModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};