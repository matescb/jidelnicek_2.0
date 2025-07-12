import React, { useState, useCallback, useMemo, memo } from 'react'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DraggableLocation,
} from '@hello-pangea/dnd'
import { format, parseISO } from 'date-fns'
import {
  Search,
  Filter,
  Clock,
  Users,
  Flame,
  ChevronDown,
  ChevronUp,
  X,
  Copy,
  Trash2,
  Calendar,
  Info,
  AlertCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Trip, DayPlan, MealSlot, Meal } from '@/store/slices/tripStore'
import type { Recipe } from '@/types/recipe'
import { useTripStore } from '@/store/slices/tripStore'
import { TouchableArea } from '../ui/TouchableArea'
import { toast } from 'react-hot-toast'
import { OptimizationPresets, smartMemoCompare, withMemo } from '@/components/performance'
import { useMemoizedCallback, useWhyDidYouUpdate } from '@/hooks/useOptimization'

interface MealPlanningBoardProps {
  trip: Trip
  recipes: Recipe[]
}

interface NutritionSummary {
  calories: number
  protein: number
  carbs: number
  fat: number
}

// Helper to calculate nutrition for a day
function calculateDayNutrition(meals: Meal[]): NutritionSummary {
  return meals.reduce(
    (acc, meal) => {
      const nutrition = meal.recipe.nutrition
      if (!nutrition) return acc
      
      const servingMultiplier = (meal.servingsOverride || meal.recipe.servings) / meal.recipe.servings
      
      return {
        calories: acc.calories + (nutrition.calories * servingMultiplier),
        protein: acc.protein + (nutrition.protein * servingMultiplier),
        carbs: acc.carbs + (nutrition.carbs * servingMultiplier),
        fat: acc.fat + (nutrition.fat * servingMultiplier),
      }
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

// Recipe Card Component for Sidebar - Memoized
const RecipeCardDraggable = memo<{
  recipe: Recipe
  index: number
}>(({ recipe, index }) => {
  const { t } = useTranslation()
  
  return (
    <Draggable draggableId={`recipe-${recipe.id}`} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 ${snapshot.isDragging ? 'opacity-50' : ''}`}
        >
          <TouchableArea
            as="div"
            className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 cursor-move hover:shadow-md transition-shadow ${
              snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {recipe.imageUrl ? (
                <img
                  src={recipe.imageUrl}
                  alt={recipe.name}
                  className="w-16 h-16 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                  <Flame className="w-6 h-6 text-gray-400" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                  {recipe.name}
                </h4>
                
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {recipe.prepTime && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{recipe.prepTime}min</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{recipe.servings}</span>
                  </div>
                </div>
                
                {recipe.nutrition && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {recipe.nutrition.calories} kcal
                  </div>
                )}
              </div>
            </div>
          </TouchableArea>
        </div>
      )}
    </Draggable>
  )
})

// Meal Slot Component
const MealSlotDroppable: React.FC<{
  day: DayPlan
  mealSlot: MealSlot
  meals: Meal[]
  onRemoveMeal: (dayId: string, mealId: string) => void
}> = ({ day, mealSlot, meals, onRemoveMeal }) => {
  const { t } = useTranslation()
  const slotMeals = meals.filter(m => m.mealSlot === mealSlot.id)
  
  return (
    <div className="mb-4">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
        {mealSlot.customName || t(`trips.mealTypes.${mealSlot.mealType}`)}
      </h4>
      
      <Droppable droppableId={`${day.id}-${mealSlot.id}`}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[80px] bg-gray-50 dark:bg-gray-900 rounded-lg p-2 border-2 border-dashed transition-colors ${
              snapshot.isDraggingOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            {slotMeals.length === 0 && !snapshot.isDraggingOver && (
              <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-6">
                {t('trips.dragRecipeHere')}
              </p>
            )}
            
            {slotMeals.map((meal, index) => (
              <Draggable
                key={meal.id}
                draggableId={`meal-${meal.id}`}
                index={index}
              >
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    className={`mb-2 ${snapshot.isDragging ? 'opacity-50' : ''}`}
                  >
                    <TouchableArea
                      as="div"
                      className={`bg-white dark:bg-gray-800 rounded p-2 shadow-sm hover:shadow-md transition-shadow ${
                        snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {meal.recipe.imageUrl ? (
                            <img
                              src={meal.recipe.imageUrl}
                              alt={meal.recipe.name}
                              className="w-10 h-10 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                              <Flame className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          
                          <div className="min-w-0">
                            <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {meal.recipe.name}
                            </h5>
                            {meal.recipe.nutrition && (
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {meal.recipe.nutrition.calories} kcal
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveMeal(day.id, meal.id)
                          }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                      </div>
                      
                      {meal.notes && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                          {meal.notes}
                        </p>
                      )}
                    </TouchableArea>
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  )
}

// Day Card Component
const DayCard: React.FC<{
  day: DayPlan
  mealSlots: MealSlot[]
  onRemoveMeal: (dayId: string, mealId: string) => void
  onCopyDay: (dayId: string) => void
  onClearDay: (dayId: string) => void
}> = ({ day, mealSlots, onRemoveMeal, onCopyDay, onClearDay }) => {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const nutrition = calculateDayNutrition(day.meals)
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {t('trips.dayNumber', { number: day.dayNumber })}
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {format(parseISO(day.date), 'EEE, MMM d')}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => onCopyDay(day.id)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title={t('trips.copyDay')}
            >
              <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => onClearDay(day.id)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title={t('trips.clearDay')}
            >
              <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              )}
            </button>
          </div>
        </div>
        
        {/* Nutrition Summary */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center p-1 bg-gray-50 dark:bg-gray-900 rounded">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {Math.round(nutrition.calories)}
            </div>
            <div className="text-gray-500 dark:text-gray-400">kcal</div>
          </div>
          <div className="text-center p-1 bg-gray-50 dark:bg-gray-900 rounded">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {Math.round(nutrition.protein)}g
            </div>
            <div className="text-gray-500 dark:text-gray-400">{t('nutrition.protein')}</div>
          </div>
          <div className="text-center p-1 bg-gray-50 dark:bg-gray-900 rounded">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {Math.round(nutrition.carbs)}g
            </div>
            <div className="text-gray-500 dark:text-gray-400">{t('nutrition.carbs')}</div>
          </div>
          <div className="text-center p-1 bg-gray-50 dark:bg-gray-900 rounded">
            <div className="font-medium text-gray-900 dark:text-gray-100">
              {Math.round(nutrition.fat)}g
            </div>
            <div className="text-gray-500 dark:text-gray-400">{t('nutrition.fat')}</div>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-4">
          {mealSlots
            .filter(slot => slot.isActive)
            .sort((a, b) => a.displayOrder - b.displayOrder)
            .map(slot => (
              <MealSlotDroppable
                key={slot.id}
                day={day}
                mealSlot={slot}
                meals={day.meals}
                onRemoveMeal={onRemoveMeal}
              />
            ))}
        </div>
      )}
    </div>
  )
}

const MealPlanningBoardComponent: React.FC<MealPlanningBoardProps> = ({ trip, recipes }) => {
  const { t } = useTranslation()
  const { assignMeal, removeMeal, updateTrip } = useTripStore()
  
  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('')
  const [copiedDay, setCopiedDay] = useState<DayPlan | null>(null)
  
  // Filter recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter(recipe => {
      const matchesSearch = !searchTerm || 
        recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.description?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesCategory = !selectedCategory || 
        recipe.categories?.includes(selectedCategory)
      
      const matchesDifficulty = !selectedDifficulty || 
        recipe.difficulty === selectedDifficulty
      
      return matchesSearch && matchesCategory && matchesDifficulty
    })
  }, [recipes, searchTerm, selectedCategory, selectedDifficulty])
  
  // Get unique categories from recipes
  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    recipes.forEach(recipe => {
      recipe.categories?.forEach(cat => categories.add(cat))
    })
    return Array.from(categories).sort()
  }, [recipes])
  
  // Handle drag end
  const handleDragEnd = useCallback(async (result: DropResult) => {
    if (!result.destination) return
    
    const { source, destination, draggableId } = result
    
    // If dragging a recipe from sidebar to a meal slot
    if (draggableId.startsWith('recipe-')) {
      const recipeId = draggableId.replace('recipe-', '')
      const [dayId, mealSlotId] = destination.droppableId.split('-')
      
      try {
        await assignMeal(trip.id, dayId, mealSlotId, recipeId)
        toast.success(t('trips.mealAssigned'))
      } catch (error) {
        toast.error(t('trips.mealAssignError'))
      }
    }
    // If moving a meal between slots
    else if (draggableId.startsWith('meal-')) {
      // This would require backend support for moving meals between slots
      // For now, we'll show a message
      toast.info(t('trips.mealMovingNotSupported'))
    }
  }, [trip.id, assignMeal, t])
  
  // Handle removing a meal
  const handleRemoveMeal = useCallback(async (dayId: string, mealId: string) => {
    try {
      await removeMeal(trip.id, dayId, mealId)
      toast.success(t('trips.mealRemoved'))
    } catch (error) {
      toast.error(t('trips.mealRemoveError'))
    }
  }, [trip.id, removeMeal, t])
  
  // Handle copying a day
  const handleCopyDay = useCallback((dayId: string) => {
    const day = trip.days.find(d => d.id === dayId)
    if (day) {
      setCopiedDay(day)
      toast.success(t('trips.dayCopied'))
    }
  }, [trip.days, t])
  
  // Handle pasting to a day
  const handlePasteDay = useCallback(async (targetDayId: string) => {
    if (!copiedDay) return
    
    const targetDay = trip.days.find(d => d.id === targetDayId)
    if (!targetDay) return
    
    try {
      // Copy each meal from the copied day to the target day
      for (const meal of copiedDay.meals) {
        await assignMeal(trip.id, targetDayId, meal.mealSlot, meal.recipe.id)
      }
      toast.success(t('trips.dayPasted'))
    } catch (error) {
      toast.error(t('trips.dayPasteError'))
    }
  }, [copiedDay, trip, assignMeal, t])
  
  // Handle clearing a day
  const handleClearDay = useCallback(async (dayId: string) => {
    const day = trip.days.find(d => d.id === dayId)
    if (!day) return
    
    if (!window.confirm(t('trips.confirmClearDay'))) return
    
    try {
      // Remove all meals from the day
      for (const meal of day.meals) {
        await removeMeal(trip.id, dayId, meal.id)
      }
      toast.success(t('trips.dayCleared'))
    } catch (error) {
      toast.error(t('trips.dayClearError'))
    }
  }, [trip, removeMeal, t])
  
  // Handle copying entire week
  const handleCopyWeek = useCallback(async () => {
    if (!window.confirm(t('trips.confirmCopyWeek'))) return
    
    try {
      // Get meals from first 7 days
      const firstWeek = trip.days.slice(0, 7)
      const remainingDays = trip.days.slice(7)
      
      for (let i = 0; i < remainingDays.length; i++) {
        const sourceDay = firstWeek[i % 7]
        const targetDay = remainingDays[i]
        
        // Copy meals from source day to target day
        for (const meal of sourceDay.meals) {
          await assignMeal(trip.id, targetDay.id, meal.mealSlot, meal.recipe.id)
        }
      }
      
      toast.success(t('trips.weekCopied'))
    } catch (error) {
      toast.error(t('trips.weekCopyError'))
    }
  }, [trip, assignMeal, t])
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Left Sidebar - Recipe List */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 sticky top-4">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-4">
              {t('trips.availableRecipes')}
            </h3>
            
            {/* Search and Filters */}
            <div className="space-y-3 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('common.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
                />
              </div>
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">{t('recipes.allCategories')}</option>
                {availableCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="">{t('recipes.allDifficulties')}</option>
                <option value="easy">{t('recipes.difficultyLevels.easy')}</option>
                <option value="medium">{t('recipes.difficultyLevels.medium')}</option>
                <option value="hard">{t('recipes.difficultyLevels.hard')}</option>
              </select>
            </div>
            
            {/* Recipe List */}
            <Droppable droppableId="recipe-list" isDropDisabled={true}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="max-h-[calc(100vh-300px)] overflow-y-auto pr-2 -mr-2"
                >
                  {filteredRecipes.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                      {t('recipes.noRecipesFound')}
                    </p>
                  ) : (
                    filteredRecipes.map((recipe, index) => (
                      <RecipeCardDraggable
                        key={recipe.id}
                        recipe={recipe}
                        index={index}
                      />
                    ))
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </div>
        
        {/* Main Content - Day Cards */}
        <div className="flex-1">
          {/* Action Bar */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t('trips.dragInstructions')}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {copiedDay && (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t('trips.copiedDayInfo', { day: copiedDay.dayNumber })}
                  </div>
                )}
                
                <button
                  onClick={handleCopyWeek}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {t('trips.copyFirstWeek')}
                </button>
              </div>
            </div>
          </div>
          
          {/* Days Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {trip.days.map(day => (
              <DayCard
                key={day.id}
                day={day}
                mealSlots={trip.mealSlotConfiguration}
                onRemoveMeal={handleRemoveMeal}
                onCopyDay={handleCopyDay}
                onClearDay={handleClearDay}
              />
            ))}
          </div>
          
          {/* Trip Summary */}
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-4">
              {t('trips.tripSummary')}
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {trip.days.reduce((acc, day) => acc + day.meals.length, 0)}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('trips.totalMeals')}
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {new Set(trip.days.flatMap(day => day.meals.map(m => m.recipe.id))).size}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('trips.uniqueRecipes')}
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {Math.round(
                    trip.days.reduce((acc, day) => {
                      const dayNutrition = calculateDayNutrition(day.meals)
                      return acc + dayNutrition.calories
                    }, 0) / trip.days.length
                  )}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('trips.avgDailyCalories')}
                </div>
              </div>
              
              <div className="text-center p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {trip.participantCount}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {t('trips.participants')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DragDropContext>
  )
}

// Export with memoization - only re-render when trip or recipes change significantly
export const MealPlanningBoard = memo(MealPlanningBoardComponent, (prevProps, nextProps) => {
  // Compare trip
  if (prevProps.trip.id !== nextProps.trip.id) return false
  if (prevProps.trip.days.length !== nextProps.trip.days.length) return false
  
  // Compare recipes array length (actual recipe changes are less important for board layout)
  if (prevProps.recipes.length !== nextProps.recipes.length) return false
  
  return true
})