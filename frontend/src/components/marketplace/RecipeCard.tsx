import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Typography,
  Chip,
  Button,
  Box,
  Avatar,
  Rating,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  AccessTime as TimeIcon,
  Restaurant as RestaurantIcon,
  Visibility as ViewIcon,
  CallSplit as ForkIcon,
  Star as StarIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  Share as ShareIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { MarketplaceRecipe } from './MarketplaceDiscovery';

interface RecipeCardProps {
  recipe: MarketplaceRecipe;
  onClick?: () => void;
  onFavorite?: (recipeId: string) => void;
  onShare?: (recipe: MarketplaceRecipe) => void;
  viewMode?: 'grid' | 'list';
  isFavorited?: boolean;
  showActions?: boolean;
}

export const RecipeCard: React.FC<RecipeCardProps> = ({
  recipe,
  onClick,
  onFavorite,
  onShare,
  viewMode = 'grid',
  isFavorited = false,
  showActions = true
}) => {
  const { t } = useTranslation();
  
  // Calculate total time
  const totalTime = (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);
  
  // Get primary image
  const primaryImage = recipe.images?.[0]?.image_url;
  
  // Format difficulty
  const formatDifficulty = (difficulty?: string) => {
    if (!difficulty) return null;
    return t(`marketplace.difficulty.${difficulty}`);
  };
  
  // Format cuisine
  const formatCuisine = (cuisine?: string) => {
    if (!cuisine) return null;
    return t(`marketplace.cuisine.${cuisine}`);
  };
  
  // Get difficulty color
  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'beginner': return 'success';
      case 'intermediate': return 'warning';
      case 'advanced': return 'error';
      case 'expert': return 'error';
      default: return 'default';
    }
  };
  
  if (viewMode === 'list') {
    return (
      <Card 
        sx={{ 
          display: 'flex',
          cursor: onClick ? 'pointer' : 'default',
          '&:hover': onClick ? {
            transform: 'translateY(-2px)',
            boxShadow: 3,
          } : {},
          transition: 'all 0.2s ease-in-out',
        }}
        onClick={onClick}
      >
        {/* Image */}
        <CardMedia
          component="img"
          sx={{ width: 200, height: 150, objectFit: 'cover' }}
          image={primaryImage || '/images/placeholder-recipe.jpg'}
          alt={recipe.name}
        />
        
        {/* Content */}
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <CardContent sx={{ flex: 1 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
              <Typography variant="h6" component="h3" noWrap sx={{ flex: 1, mr: 2 }}>
                {recipe.name}
              </Typography>
              
              {recipe.difficulty_level && (
                <Chip
                  label={formatDifficulty(recipe.difficulty_level)}
                  size="small"
                  color={getDifficultyColor(recipe.difficulty_level) as any}
                  variant="outlined"
                />
              )}
            </Box>
            
            {/* Author */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Avatar 
                src={recipe.author.profile_image_url} 
                sx={{ width: 24, height: 24, mr: 1 }}
              >
                <PersonIcon fontSize="small" />
              </Avatar>
              <Typography variant="body2" color="text.secondary">
                {recipe.author.name}
              </Typography>
            </Box>
            
            {/* Description */}
            {recipe.description && (
              <Typography 
                variant="body2" 
                color="text.secondary" 
                sx={{ 
                  mb: 2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {recipe.description}
              </Typography>
            )}
            
            {/* Metadata */}
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', mb: 2 }}>
              {totalTime > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <TimeIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {totalTime} {t('common.minutes')}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <RestaurantIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {recipe.servings} {t('common.servings')}
                </Typography>
              </Box>
              
              {recipe.cuisine_type && (
                <Chip
                  label={formatCuisine(recipe.cuisine_type)}
                  size="small"
                  variant="outlined"
                />
              )}
            </Box>
            
            {/* Dietary Tags */}
            {recipe.dietary_tags && recipe.dietary_tags.length > 0 && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {recipe.dietary_tags.slice(0, 3).map((tag) => (
                  <Chip
                    key={tag}
                    label={t(`marketplace.dietary.${tag}`)}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                ))}
                {recipe.dietary_tags.length > 3 && (
                  <Chip
                    label={`+${recipe.dietary_tags.length - 3}`}
                    size="small"
                    variant="outlined"
                    color="default"
                  />
                )}
              </Box>
            )}
          </CardContent>
          
          {/* Stats and Actions */}
          <Box sx={{ px: 2, pb: 2 }}>
            <Divider sx={{ mb: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* Stats */}
              <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {/* Rating */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Rating
                    value={recipe.average_rating || 0}
                    readOnly
                    size="small"
                    precision={0.1}
                  />
                  <Typography variant="body2" color="text.secondary">
                    ({recipe.rating_count})
                  </Typography>
                </Box>
                
                {/* Views */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ViewIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {recipe.view_count.toLocaleString()}
                  </Typography>
                </Box>
                
                {/* Forks */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <ForkIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {recipe.fork_count}
                  </Typography>
                </Box>
              </Box>
              
              {/* Actions */}
              {showActions && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Tooltip title={isFavorited ? t('marketplace.unfavorite') : t('marketplace.favorite')}>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onFavorite?.(recipe.id);
                      }}
                      color={isFavorited ? 'error' : 'default'}
                    >
                      {isFavorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                    </IconButton>
                  </Tooltip>
                  
                  <Tooltip title={t('marketplace.share')}>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onShare?.(recipe);
                      }}
                    >
                      <ShareIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Card>
    );
  }
  
  // Grid view
  return (
    <Card 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        } : {},
        transition: 'all 0.2s ease-in-out',
      }}
      onClick={onClick}
    >
      {/* Image */}
      <CardMedia
        component="img"
        height={200}
        image={primaryImage || '/images/placeholder-recipe.jpg'}
        alt={recipe.name}
        sx={{ objectFit: 'cover' }}
      />
      
      {/* Content */}
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
          <Typography 
            variant="h6" 
            component="h3" 
            sx={{ 
              flex: 1, 
              mr: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.3,
            }}
          >
            {recipe.name}
          </Typography>
          
          {recipe.difficulty_level && (
            <Chip
              label={formatDifficulty(recipe.difficulty_level)}
              size="small"
              color={getDifficultyColor(recipe.difficulty_level) as any}
              variant="outlined"
            />
          )}
        </Box>
        
        {/* Author */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar 
            src={recipe.author.profile_image_url} 
            sx={{ width: 24, height: 24, mr: 1 }}
          >
            <PersonIcon fontSize="small" />
          </Avatar>
          <Typography variant="body2" color="text.secondary">
            {recipe.author.name}
          </Typography>
        </Box>
        
        {/* Metadata */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 1 }}>
            {totalTime > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <TimeIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {totalTime}m
                </Typography>
              </Box>
            )}
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <RestaurantIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {recipe.servings}
              </Typography>
            </Box>
          </Box>
          
          {recipe.cuisine_type && (
            <Chip
              label={formatCuisine(recipe.cuisine_type)}
              size="small"
              variant="outlined"
              sx={{ mb: 1 }}
            />
          )}
        </Box>
        
        {/* Dietary Tags */}
        {recipe.dietary_tags && recipe.dietary_tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {recipe.dietary_tags.slice(0, 2).map((tag) => (
              <Chip
                key={tag}
                label={t(`marketplace.dietary.${tag}`)}
                size="small"
                variant="outlined"
                color="primary"
              />
            ))}
            {recipe.dietary_tags.length > 2 && (
              <Chip
                label={`+${recipe.dietary_tags.length - 2}`}
                size="small"
                variant="outlined"
                color="default"
              />
            )}
          </Box>
        )}
        
        {/* Spacer */}
        <Box sx={{ flex: 1 }} />
        
        {/* Stats */}
        <Box sx={{ mb: 2 }}>
          {/* Rating */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Rating
              value={recipe.average_rating || 0}
              readOnly
              size="small"
              precision={0.1}
            />
            <Typography variant="body2" color="text.secondary">
              ({recipe.rating_count})
            </Typography>
          </Box>
          
          {/* Engagement stats */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ViewIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {recipe.view_count > 999 ? `${Math.floor(recipe.view_count / 1000)}k` : recipe.view_count}
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ForkIcon fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {recipe.fork_count}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
      
      {/* Actions */}
      {showActions && (
        <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
          <Button 
            size="small" 
            variant="outlined"
            onClick={(e) => {
              e.stopPropagation();
              onClick?.();
            }}
          >
            {t('marketplace.viewRecipe')}
          </Button>
          
          <Box>
            <Tooltip title={isFavorited ? t('marketplace.unfavorite') : t('marketplace.favorite')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onFavorite?.(recipe.id);
                }}
                color={isFavorited ? 'error' : 'default'}
              >
                {isFavorited ? <FavoriteIcon /> : <FavoriteBorderIcon />}
              </IconButton>
            </Tooltip>
            
            <Tooltip title={t('marketplace.share')}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onShare?.(recipe);
                }}
              >
                <ShareIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </CardActions>
      )}
    </Card>
  );
};

export default RecipeCard;
