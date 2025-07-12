import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { 
  Clock, 
  Users, 
  Flame, 
  Star, 
  Heart, 
  Edit3, 
  Copy, 
  Trash2,
  Share2,
  Printer,
  ChefHat,
  Calendar,
  Eye,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  AlertCircle,
  Info,
  GitFork,
  MoreVertical,
  Facebook,
  Twitter,
  Link as LinkIcon
} from 'lucide-react'
import { useRecipeStore } from '@/store/slices/recipeStore'
import { useAuthStore } from '@/store/slices/authStore'
import { useI18nFormats } from '@/hooks/useI18nFormats'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RecipeCard } from '@/components/recipes/RecipeCard'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'
import { cn } from '@/lib/utils'
import { apiClient } from '@/api/client'
import type { Recipe } from '@/types/recipe'

interface RelatedRecipesResponse {
  items: Recipe[]
  total: number
}

const RecipeDetailPage: React.FC = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { formatNumber, formatDate } = useI18nFormats()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const printRef = useRef<HTMLDivElement>(null)
  
  const { 
    currentRecipe, 
    loading, 
    error, 
    fetchRecipe, 
    deleteRecipe, 
    duplicateRecipe,
    toggleFavorite,
    rateRecipe,
    favorites,
    clearError
  } = useRecipeStore()
  
  const user = useAuthStore((state) => state.user)
  
  const [relatedRecipes, setRelatedRecipes] = useState<Recipe[]>([])
  const [loadingRelated, setLoadingRelated] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [userRating, setUserRating] = useState(0)
  const [isRatingHovered, setIsRatingHovered] = useState(false)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [copiedLink, setCopiedLink] = useState(false)
  
  const isFavorite = currentRecipe ? favorites.includes(currentRecipe.id) : false
  const isOwner = user?.id === currentRecipe?.userId
  
  // Fetch recipe data
  useEffect(() => {
    if (id) {
      fetchRecipe(id)
    }
    
    return () => {
      clearError()
    }
  }, [id, fetchRecipe, clearError])
  
  // Fetch related recipes
  useEffect(() => {
    const fetchRelatedRecipes = async () => {
      if (!currentRecipe) return
      
      setLoadingRelated(true)
      try {
        // Fetch related recipes based on categories/tags
        const response = await apiClient.get<RelatedRecipesResponse>(`/recipes/${currentRecipe.id}/related`)
        setRelatedRecipes(response.data.items.slice(0, 6))
      } catch (error) {
        console.error('Failed to fetch related recipes:', error)
      } finally {
        setLoadingRelated(false)
      }
    }
    
    fetchRelatedRecipes()
  }, [currentRecipe])
  
  const handleDelete = async () => {
    if (!currentRecipe) return
    
    try {
      await deleteRecipe(currentRecipe.id)
      navigate('/dashboard/recipes')
    } catch (error) {
      console.error('Failed to delete recipe:', error)
    }
    setDeleteDialogOpen(false)
  }
  
  const handleDuplicate = async () => {
    if (!currentRecipe) return
    
    try {
      const duplicated = await duplicateRecipe(currentRecipe.id)
      navigate(`/recipes/${duplicated.id}/edit`)
    } catch (error) {
      console.error('Failed to duplicate recipe:', error)
    }
  }
  
  const handleFork = async () => {
    if (!currentRecipe) return
    
    // Fork is similar to duplicate but maintains reference to original
    try {
      const forked = await duplicateRecipe(currentRecipe.id)
      navigate(`/recipes/${forked.id}/edit`)
    } catch (error) {
      console.error('Failed to fork recipe:', error)
    }
  }
  
  const handleToggleFavorite = async () => {
    if (!currentRecipe) return
    
    try {
      await toggleFavorite(currentRecipe.id)
    } catch (error) {
      console.error('Failed to toggle favorite:', error)
    }
  }
  
  const handleRating = async (rating: number) => {
    if (!currentRecipe || !user) return
    
    try {
      await rateRecipe(currentRecipe.id, rating)
      setUserRating(rating)
    } catch (error) {
      console.error('Failed to rate recipe:', error)
    }
  }
  
  const handlePrint = () => {
    window.print()
  }
  
  const handleShareSocial = (platform: 'facebook' | 'twitter') => {
    if (!currentRecipe) return
    
    const url = window.location.href
    const text = `Check out this recipe: ${currentRecipe.name}`
    
    const shareUrls = {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    }
    
    window.open(shareUrls[platform], '_blank', 'width=600,height=400')
  }
  
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }
  
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
      case 'medium':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
      case 'hard':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20'
    }
  }
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <RecipeDetailSkeleton />
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button 
          onClick={() => navigate('/dashboard/recipes')} 
          className="mt-4"
          variant="outline"
        >
          {t('common.back')}
        </Button>
      </div>
    )
  }
  
  if (!currentRecipe) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t('recipes.notFound')}</AlertTitle>
          <AlertDescription>{t('recipes.notFoundDescription')}</AlertDescription>
        </Alert>
        <Button 
          onClick={() => navigate('/dashboard/recipes')} 
          className="mt-4"
          variant="outline"
        >
          {t('common.back')}
        </Button>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center space-x-2">
          <li>
            <Link to="/recipes" className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              {t('recipes.title')}
            </Link>
          </li>
          <li className="text-gray-400 dark:text-gray-600">/</li>
          <li className="text-gray-900 dark:text-gray-100 font-medium truncate max-w-xs">
            {currentRecipe.name}
          </li>
        </ol>
      </nav>
      
      {/* Main Content */}
      <div ref={printRef} className="print:p-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                      {currentRecipe.name}
                    </h1>
                    {currentRecipe.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-lg">
                        {currentRecipe.description}
                      </p>
                    )}
                    
                    {/* Author Info */}
                    {currentRecipe.author && (
                      <div className="flex items-center gap-3 mt-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={currentRecipe.author.avatar} alt={currentRecipe.author.name} />
                          <AvatarFallback>{currentRecipe.author.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {currentRecipe.author.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(currentRecipe.createdAt)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 print:hidden">
                    {user && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={handleToggleFavorite}
                              className={cn(
                                "transition-colors",
                                isFavorite && "text-red-500 hover:text-red-600"
                              )}
                            >
                              <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isFavorite ? t('recipes.unfavorite') : t('recipes.favorite')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setShareDialogOpen(true)}>
                          <Share2 className="mr-2 h-4 w-4" />
                          {t('common.share')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handlePrint}>
                          <Printer className="mr-2 h-4 w-4" />
                          {t('common.print')}
                        </DropdownMenuItem>
                        {user && (
                          <>
                            <DropdownMenuSeparator />
                            {isOwner ? (
                              <>
                                <DropdownMenuItem onClick={() => navigate(`/recipes/${currentRecipe.id}/edit`)}>
                                  <Edit3 className="mr-2 h-4 w-4" />
                                  {t('common.edit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleDuplicate}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  {t('recipes.duplicate')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setDeleteDialogOpen(true)}
                                  className="text-red-600 dark:text-red-400"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  {t('common.delete')}
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <DropdownMenuItem onClick={handleFork}>
                                <GitFork className="mr-2 h-4 w-4" />
                                {t('recipes.fork')}
                              </DropdownMenuItem>
                            )}
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                {/* Metadata */}
                <div className="flex flex-wrap gap-4 mt-6 text-sm">
                  {currentRecipe.totalTime && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Clock className="h-4 w-4" />
                      <span>{currentRecipe.totalTime} {t('common.minutes')}</span>
                    </div>
                  )}
                  {currentRecipe.servings && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Users className="h-4 w-4" />
                      <span>{currentRecipe.servings} {t('recipes.servings')}</span>
                    </div>
                  )}
                  {currentRecipe.difficulty && (
                    <Badge 
                      variant="secondary" 
                      className={cn("flex items-center gap-1", getDifficultyColor(currentRecipe.difficulty))}
                    >
                      <Flame className="h-3 w-3" />
                      {t(`recipes.difficultyLevels.${currentRecipe.difficulty}`)}
                    </Badge>
                  )}
                  <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                    <Eye className="h-4 w-4" />
                    <span>{formatNumber(currentRecipe.viewCount)} {t('recipes.views')}</span>
                  </div>
                </div>
                
                {/* Rating */}
                {currentRecipe.ratingAverage > 0 && (
                  <div className="flex items-center gap-4 mt-4">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={cn(
                            "h-5 w-5 transition-colors cursor-pointer",
                            i < Math.round(currentRecipe.ratingAverage)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300 dark:text-gray-600",
                            user && "hover:text-yellow-400"
                          )}
                          onMouseEnter={() => {
                            if (user) {
                              setIsRatingHovered(true)
                              setHoveredRating(i + 1)
                            }
                          }}
                          onMouseLeave={() => {
                            setIsRatingHovered(false)
                            setHoveredRating(0)
                          }}
                          onClick={() => user && handleRating(i + 1)}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {formatNumber(currentRecipe.ratingAverage, 'number')} ({currentRecipe.ratingCount} {t('recipes.ratings')})
                    </span>
                  </div>
                )}
                
                {/* Tags */}
                {currentRecipe.tags && currentRecipe.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {currentRecipe.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Images */}
            {currentRecipe.images && currentRecipe.images.length > 0 && (
              <Card className="print:shadow-none print:border-0">
                <CardContent className="p-0">
                  <Carousel 
                    className="w-full" 
                    opts={{
                      align: "start",
                      loop: true,
                    }}
                  >
                    <CarouselContent>
                      {currentRecipe.images.map((image, index) => (
                        <CarouselItem key={image.id}>
                          <div className="relative aspect-video">
                            <img
                              src={image.url}
                              alt={image.alt || `${currentRecipe.name} - Image ${index + 1}`}
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    {currentRecipe.images.length > 1 && (
                      <>
                        <CarouselPrevious className="print:hidden" />
                        <CarouselNext className="print:hidden" />
                      </>
                    )}
                  </Carousel>
                </CardContent>
              </Card>
            )}
            
            {/* Instructions and Ingredients Tabs */}
            <Card className="print:shadow-none print:border-0">
              <CardContent className="p-6">
                <Tabs defaultValue="ingredients" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 print:hidden">
                    <TabsTrigger value="ingredients">{t('recipes.ingredients')}</TabsTrigger>
                    <TabsTrigger value="instructions">{t('recipes.instructions')}</TabsTrigger>
                  </TabsList>
                  
                  {/* Ingredients */}
                  <TabsContent value="ingredients" className="mt-6">
                    <div className="print:block">
                      <h2 className="text-xl font-semibold mb-4 hidden print:block">
                        {t('recipes.ingredients')}
                      </h2>
                      <ul className="space-y-3">
                        {currentRecipe.ingredients.map((ingredient, index) => (
                          <li key={index} className="flex items-start gap-3">
                            <div className="mt-1.5 h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                            <div className="flex-1">
                              <span className="font-medium">
                                {formatNumber(ingredient.quantity)} {ingredient.unit}
                              </span>{' '}
                              <span className="text-gray-700 dark:text-gray-300">
                                {ingredient.name}
                              </span>
                              {ingredient.notes && (
                                <span className="text-gray-500 dark:text-gray-400 text-sm block mt-1">
                                  {ingredient.notes}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </TabsContent>
                  
                  {/* Instructions */}
                  <TabsContent value="instructions" className="mt-6">
                    <div className="print:block print:mt-8">
                      <h2 className="text-xl font-semibold mb-4 hidden print:block">
                        {t('recipes.instructions')}
                      </h2>
                      <ol className="space-y-4">
                        {currentRecipe.instructions.map((instruction) => (
                          <li key={instruction.step} className="flex gap-4">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                              {instruction.step}
                            </div>
                            <div className="flex-1 pt-1 text-gray-700 dark:text-gray-300">
                              {instruction.text}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
          
          {/* Right Column - Sidebar */}
          <div className="space-y-6 print:hidden">
            {/* Nutrition Info */}
            {currentRecipe.nutrition && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('recipes.nutritionInfo')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('recipes.nutrition.calories')}</p>
                      <p className="font-semibold">{formatNumber(currentRecipe.nutrition.calories)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('recipes.nutrition.protein')}</p>
                      <p className="font-semibold">{formatNumber(currentRecipe.nutrition.protein)}g</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('recipes.nutrition.carbs')}</p>
                      <p className="font-semibold">{formatNumber(currentRecipe.nutrition.carbs)}g</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('recipes.nutrition.fat')}</p>
                      <p className="font-semibold">{formatNumber(currentRecipe.nutrition.fat)}g</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('recipes.nutrition.fiber')}</p>
                      <p className="font-semibold">{formatNumber(currentRecipe.nutrition.fiber)}g</p>
                    </div>
                    <div>
                      <p className="text-gray-500 dark:text-gray-400">{t('recipes.nutrition.sodium')}</p>
                      <p className="font-semibold">{formatNumber(currentRecipe.nutrition.sodium)}mg</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Recipe Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('recipes.recipeInfo')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {currentRecipe.prepTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('recipes.prepTime')}</span>
                    <span className="font-medium">{currentRecipe.prepTime} {t('common.minutes')}</span>
                  </div>
                )}
                {currentRecipe.cookTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('recipes.cookTime')}</span>
                    <span className="font-medium">{currentRecipe.cookTime} {t('common.minutes')}</span>
                  </div>
                )}
                {currentRecipe.totalTime && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">{t('recipes.totalTime')}</span>
                    <span className="font-medium">{currentRecipe.totalTime} {t('common.minutes')}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('common.createdAt')}</span>
                  <span className="font-medium">{formatDate(currentRecipe.createdAt, 'short')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">{t('common.updatedAt')}</span>
                  <span className="font-medium">{formatDate(currentRecipe.updatedAt, 'short')}</span>
                </div>
              </CardContent>
            </Card>
            
            {/* Categories */}
            {currentRecipe.categories && currentRecipe.categories.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('recipes.categories')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {currentRecipe.categories.map((category) => (
                      <Badge key={category} variant="secondary">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
        
        {/* Related Recipes */}
        {relatedRecipes.length > 0 && (
          <div className="mt-12 print:hidden">
            <h2 className="text-2xl font-semibold mb-6">{t('recipes.relatedRecipes')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingRelated ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-64" />
                ))
              ) : (
                relatedRecipes.map((recipe) => (
                  <RecipeCard key={recipe.id} recipe={recipe} />
                ))
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('recipes.deleteRecipe')}</DialogTitle>
            <DialogDescription>
              {t('recipes.deleteRecipeConfirm', { name: currentRecipe.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('recipes.shareRecipe')}</DialogTitle>
            <DialogDescription>
              {t('recipes.shareRecipeDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleShareSocial('facebook')}
              >
                <Facebook className="h-4 w-4 mr-2" />
                Facebook
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => handleShareSocial('twitter')}
              >
                <Twitter className="h-4 w-4 mr-2" />
                Twitter
              </Button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={window.location.href}
                readOnly
                className="flex-1 px-3 py-2 text-sm border rounded-md bg-gray-50 dark:bg-gray-800"
              />
              <Button
                variant="outline"
                onClick={handleCopyLink}
              >
                {copiedLink ? (
                  <>{t('common.copied')}</>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4 mr-2" />
                    {t('common.copy')}
                  </>
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShareDialogOpen(false)}
            >
              {t('common.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </div>
  )
}

// Skeleton component for loading state
const RecipeDetailSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-10 w-3/4 mb-2" />
            <Skeleton className="h-6 w-full mb-4" />
            <div className="flex items-center gap-3 mb-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-0">
            <Skeleton className="h-96 w-full rounded-lg" />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-10 w-full mb-6" />
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-20 mb-1" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default RecipeDetailPage