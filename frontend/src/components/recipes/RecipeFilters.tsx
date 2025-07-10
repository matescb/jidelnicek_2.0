import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Filter, X, ChevronDown } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export interface RecipeFiltersState {
  search: string
  difficulty: string[]
  categories: string[]
  tags: string[]
  minPrepTime?: number
  maxPrepTime?: number
  minCalories?: number
  maxCalories?: number
  isPublic?: boolean
  isFavorite?: boolean
  sortBy: 'createdAt' | 'name' | 'rating' | 'prepTime' | 'calories'
  sortOrder: 'asc' | 'desc'
}

interface RecipeFiltersProps {
  filters: RecipeFiltersState
  onFiltersChange: (filters: RecipeFiltersState) => void
  availableCategories?: string[]
  availableTags?: string[]
}

export function RecipeFilters({
  filters,
  onFiltersChange,
  availableCategories = [],
  availableTags = []
}: RecipeFiltersProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('sm')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(['difficulty'])
  
  const debouncedSearch = useDebounce(filters.search, 300)
  
  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value })
  }
  
  const handleDifficultyToggle = (difficulty: string) => {
    const newDifficulty = filters.difficulty.includes(difficulty)
      ? filters.difficulty.filter(d => d !== difficulty)
      : [...filters.difficulty, difficulty]
    onFiltersChange({ ...filters, difficulty: newDifficulty })
  }
  
  const handleCategoryToggle = (category: string) => {
    const newCategories = filters.categories.includes(category)
      ? filters.categories.filter(c => c !== category)
      : [...filters.categories, category]
    onFiltersChange({ ...filters, categories: newCategories })
  }
  
  const handleTagToggle = (tag: string) => {
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag]
    onFiltersChange({ ...filters, tags: newTags })
  }
  
  const handleSortChange = (sortBy: RecipeFiltersState['sortBy']) => {
    const newOrder = filters.sortBy === sortBy && filters.sortOrder === 'asc' ? 'desc' : 'asc'
    onFiltersChange({ ...filters, sortBy, sortOrder: newOrder })
  }
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    )
  }
  
  const clearFilters = () => {
    onFiltersChange({
      search: '',
      difficulty: [],
      categories: [],
      tags: [],
      minPrepTime: undefined,
      maxPrepTime: undefined,
      minCalories: undefined,
      maxCalories: undefined,
      isPublic: undefined,
      isFavorite: undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    })
  }
  
  const hasActiveFilters = 
    filters.search ||
    filters.difficulty.length > 0 ||
    filters.categories.length > 0 ||
    filters.tags.length > 0 ||
    filters.minPrepTime !== undefined ||
    filters.maxPrepTime !== undefined ||
    filters.minCalories !== undefined ||
    filters.maxCalories !== undefined
  
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('common.search')}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('recipes.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      
      {/* Difficulty */}
      <div>
        <button
          onClick={() => toggleSection('difficulty')}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          <span>{t('recipes.difficulty')}</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              expandedSections.includes('difficulty') ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expandedSections.includes('difficulty') && (
          <div className="space-y-2">
            {['easy', 'medium', 'hard'].map((difficulty) => (
              <label
                key={difficulty}
                className="flex items-center cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={filters.difficulty.includes(difficulty)}
                  onChange={() => handleDifficultyToggle(difficulty)}
                  className="mr-2 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {t(`recipes.difficultyLevels.${difficulty}`)}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      
      {/* Categories */}
      {availableCategories.length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('categories')}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            <span>{t('recipes.categories')}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedSections.includes('categories') ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedSections.includes('categories') && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableCategories.map((category) => (
                <label
                  key={category}
                  className="flex items-center cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={filters.categories.includes(category)}
                    onChange={() => handleCategoryToggle(category)}
                    className="mr-2 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {category}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Tags */}
      {availableTags.length > 0 && (
        <div>
          <button
            onClick={() => toggleSection('tags')}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            <span>{t('recipes.tags')}</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                expandedSections.includes('tags') ? 'rotate-180' : ''
              }`}
            />
          </button>
          {expandedSections.includes('tags') && (
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <TouchableArea
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1 text-sm rounded-full cursor-pointer transition-colors ${
                    filters.tags.includes(tag)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {tag}
                </TouchableArea>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Prep Time Range */}
      <div>
        <button
          onClick={() => toggleSection('prepTime')}
          className="flex items-center justify-between w-full text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          <span>{t('recipes.prepTime')}</span>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              expandedSections.includes('prepTime') ? 'rotate-180' : ''
            }`}
          />
        </button>
        {expandedSections.includes('prepTime') && (
          <div className="flex gap-2">
            <input
              type="number"
              placeholder={t('common.min')}
              value={filters.minPrepTime || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                minPrepTime: e.target.value ? parseInt(e.target.value) : undefined
              })}
              className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
            <input
              type="number"
              placeholder={t('common.max')}
              value={filters.maxPrepTime || ''}
              onChange={(e) => onFiltersChange({
                ...filters,
                maxPrepTime: e.target.value ? parseInt(e.target.value) : undefined
              })}
              className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>
        )}
      </div>
      
      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
        >
          {t('common.clearFilters')}
        </button>
      )}
    </div>
  )
  
  // Mobile filters
  if (isMobile) {
    return (
      <>
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('recipes.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <TouchableArea
            onClick={() => setShowMobileFilters(true)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center gap-2"
          >
            <Filter className="w-5 h-5" />
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-blue-600 rounded-full" />
            )}
          </TouchableArea>
        </div>
        
        {/* Mobile Filter Modal */}
        {showMobileFilters && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
            <div className="bg-white dark:bg-gray-800 w-full max-h-[80vh] rounded-t-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('common.filter')}
                </h3>
                <TouchableArea
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </TouchableArea>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(80vh-4rem)]">
                <FilterContent />
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
  
  // Desktop filters
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('common.filter')}
        </h3>
        {hasActiveFilters && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {filters.difficulty.length + filters.categories.length + filters.tags.length} {t('common.active')}
          </span>
        )}
      </div>
      <FilterContent />
    </div>
  )
}