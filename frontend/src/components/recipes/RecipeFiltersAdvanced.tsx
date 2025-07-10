import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { 
  Search, 
  Filter, 
  X, 
  ChevronDown,
  Clock,
  Users,
  Flame,
  Star,
  Calendar,
  Tag,
  Utensils,
  Heart
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import type { RecipeFilters } from '@/store/slices/recipeStore'

interface RecipeFiltersAdvancedProps {
  filters: RecipeFilters
  onFiltersChange: (filters: RecipeFilters) => void
  availableCategories?: string[]
  availableTags?: string[]
  availableDietaryRestrictions?: string[]
}

export function RecipeFiltersAdvanced({
  filters,
  onFiltersChange,
  availableCategories = [],
  availableTags = [],
  availableDietaryRestrictions = []
}: RecipeFiltersAdvancedProps) {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('sm')
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [expandedSections, setExpandedSections] = useState<string[]>(['search'])
  
  const debouncedSearch = useDebounce(filters.search || '', 300)
  
  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value })
  }
  
  const handleDifficultyToggle = (difficulty: string) => {
    const currentDifficulties = filters.difficulty || []
    const newDifficulty = currentDifficulties.includes(difficulty)
      ? currentDifficulties.filter(d => d !== difficulty)
      : [...currentDifficulties, difficulty]
    onFiltersChange({ ...filters, difficulty: newDifficulty })
  }
  
  const handleCategoryToggle = (category: string) => {
    const currentCategories = filters.categories || []
    const newCategories = currentCategories.includes(category)
      ? currentCategories.filter(c => c !== category)
      : [...currentCategories, category]
    onFiltersChange({ ...filters, categories: newCategories })
  }
  
  const handleTagToggle = (tag: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    onFiltersChange({ ...filters, tags: newTags })
  }

  const handleDietaryRestrictionToggle = (restriction: string) => {
    const currentRestrictions = (filters as any).dietaryRestrictions || []
    const newRestrictions = currentRestrictions.includes(restriction)
      ? currentRestrictions.filter((r: string) => r !== restriction)
      : [...currentRestrictions, restriction]
    onFiltersChange({ ...filters, dietaryRestrictions: newRestrictions } as any)
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
  
  const activeFilterCount = [
    filters.search,
    filters.difficulty?.length,
    filters.categories?.length,
    filters.tags?.length,
    filters.minPrepTime !== undefined || filters.maxPrepTime !== undefined,
    filters.minCalories !== undefined || filters.maxCalories !== undefined,
    filters.isFavorite,
    (filters as any).dietaryRestrictions?.length
  ].filter(Boolean).length
  
  const FilterContent = () => (
    <div className="space-y-6">
      {/* Search */}
      <CollapsibleSection
        title={t('common.search')}
        icon={<Search className="w-4 h-4" />}
        defaultOpen={true}
      >
        <div className="space-y-3">
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
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('recipes.searchHint')}
          </p>
        </div>
      </CollapsibleSection>
      
      {/* Categories */}
      {availableCategories.length > 0 && (
        <CollapsibleSection
          title={t('recipes.categories')}
          icon={<Utensils className="w-4 h-4" />}
          badge={filters.categories?.length}
        >
          <div className="flex flex-wrap gap-2">
            {availableCategories.map((category) => (
              <TouchableArea
                key={category}
                onClick={() => handleCategoryToggle(category)}
                className={`px-3 py-1.5 text-sm rounded-full cursor-pointer transition-all ${
                  filters.categories?.includes(category)
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {category}
              </TouchableArea>
            ))}
          </div>
        </CollapsibleSection>
      )}
      
      {/* Difficulty */}
      <CollapsibleSection
        title={t('recipes.difficulty')}
        icon={<Star className="w-4 h-4" />}
        badge={filters.difficulty?.length}
      >
        <div className="space-y-2">
          {['easy', 'medium', 'hard'].map((difficulty) => (
            <label
              key={difficulty}
              className="flex items-center cursor-pointer group"
            >
              <Checkbox
                checked={filters.difficulty?.includes(difficulty) || false}
                onCheckedChange={() => handleDifficultyToggle(difficulty)}
                className="mr-3"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                {t(`recipes.difficultyLevels.${difficulty}`)}
              </span>
            </label>
          ))}
        </div>
      </CollapsibleSection>

      {/* Dietary Restrictions */}
      {availableDietaryRestrictions.length > 0 && (
        <CollapsibleSection
          title={t('recipes.dietaryRestrictions')}
          icon={<Heart className="w-4 h-4" />}
          badge={(filters as any).dietaryRestrictions?.length}
        >
          <div className="space-y-2">
            {availableDietaryRestrictions.map((restriction) => (
              <label
                key={restriction}
                className="flex items-center cursor-pointer group"
              >
                <Checkbox
                  checked={(filters as any).dietaryRestrictions?.includes(restriction) || false}
                  onCheckedChange={() => handleDietaryRestrictionToggle(restriction)}
                  className="mr-3"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                  {restriction}
                </span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}
      
      {/* Prep Time Range */}
      <CollapsibleSection
        title={t('recipes.prepTime')}
        icon={<Clock className="w-4 h-4" />}
        badge={filters.minPrepTime !== undefined || filters.maxPrepTime !== undefined ? 1 : undefined}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {filters.minPrepTime || 0} {t('common.minutes')}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {filters.maxPrepTime || 120} {t('common.minutes')}
            </span>
          </div>
          <Slider
            value={[filters.minPrepTime || 0, filters.maxPrepTime || 120]}
            onValueChange={([min, max]) => {
              onFiltersChange({
                ...filters,
                minPrepTime: min,
                maxPrepTime: max
              })
            }}
            max={120}
            step={5}
            className="w-full"
          />
        </div>
      </CollapsibleSection>
      
      {/* Calories Range */}
      <CollapsibleSection
        title={t('recipes.calories')}
        icon={<Flame className="w-4 h-4" />}
        badge={filters.minCalories !== undefined || filters.maxCalories !== undefined ? 1 : undefined}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {filters.minCalories || 0} kcal
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {filters.maxCalories || 1000} kcal
            </span>
          </div>
          <Slider
            value={[filters.minCalories || 0, filters.maxCalories || 1000]}
            onValueChange={([min, max]) => {
              onFiltersChange({
                ...filters,
                minCalories: min,
                maxCalories: max
              })
            }}
            max={1000}
            step={50}
            className="w-full"
          />
        </div>
      </CollapsibleSection>
      
      {/* Tags */}
      {availableTags.length > 0 && (
        <CollapsibleSection
          title={t('recipes.tags')}
          icon={<Tag className="w-4 h-4" />}
          badge={filters.tags?.length}
        >
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <Badge
                key={tag}
                variant={filters.tags?.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Additional Filters */}
      <CollapsibleSection
        title={t('recipes.additionalFilters')}
        icon={<Filter className="w-4 h-4" />}
      >
        <div className="space-y-3">
          <label className="flex items-center cursor-pointer group">
            <Checkbox
              checked={filters.isFavorite || false}
              onCheckedChange={(checked) => 
                onFiltersChange({ ...filters, isFavorite: checked as boolean })
              }
              className="mr-3"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
              {t('recipes.favoritesOnly')}
            </span>
          </label>
        </div>
      </CollapsibleSection>
      
      {/* Clear Filters */}
      {activeFilterCount > 0 && (
        <Button
          onClick={clearFilters}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <X className="w-4 h-4 mr-2" />
          {t('common.clearFilters')} ({activeFilterCount})
        </Button>
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
            {activeFilterCount > 0 && (
              <Badge variant="default" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </TouchableArea>
        </div>
        
        {/* Mobile Filter Modal */}
        {showMobileFilters && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
            <div className="bg-white dark:bg-gray-800 w-full max-h-[90vh] rounded-t-2xl overflow-hidden animate-slide-up">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {t('common.filter')}
                  {activeFilterCount > 0 && (
                    <Badge variant="default" className="ml-2">
                      {activeFilterCount}
                    </Badge>
                  )}
                </h3>
                <TouchableArea
                  onClick={() => setShowMobileFilters(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </TouchableArea>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(90vh-4rem)]">
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
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Filter className="w-5 h-5" />
          {t('common.filter')}
        </h3>
        {activeFilterCount > 0 && (
          <Badge variant="default">
            {activeFilterCount} {t('common.active')}
          </Badge>
        )}
      </div>
      <FilterContent />
    </div>
  )
}