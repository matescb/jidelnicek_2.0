import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Typography,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Rating,
  Pagination,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Autocomplete,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Trending as TrendingIcon,
  Star as StarIcon,
  Restaurant as RestaurantIcon,
  AccessTime as TimeIcon,
  LocalDining as DiningIcon,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '../../hooks/useDebounce';
import { marketplaceApi } from '../../api/marketplace';
import { RecipeCard } from './RecipeCard';
import { SearchFilters } from './SearchFilters';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export interface MarketplaceRecipe {
  id: string;
  name: string;
  description?: string;
  author: {
    id: string;
    name: string;
    profile_image_url?: string;
  };
  cuisine_type?: string;
  difficulty_level?: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings: number;
  average_rating?: number;
  rating_count: number;
  view_count: number;
  fork_count: number;
  published_at: string;
  images?: Array<{
    id: string;
    image_url: string;
  }>;
  dietary_tags?: string[];
  equipment_needed?: string[];
  season_tags?: string[];
}

export interface SearchFilters {
  cuisine_type?: string;
  difficulty_level?: string;
  min_rating?: number;
  max_calories?: number;
  max_prep_time?: number;
  max_cook_time?: number;
  dietary_tags?: string[];
  equipment_needed?: string[];
  season_tags?: string[];
  has_images?: boolean;
  is_featured?: boolean;
}

export interface SearchResponse {
  items: MarketplaceRecipe[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  search_time_ms: number;
  suggestions?: Array<{
    text: string;
    type: string;
    count?: number;
  }>;
  facets?: Record<string, Record<string, number>>;
}

interface MarketplaceDiscoveryProps {
  onRecipeSelect?: (recipe: MarketplaceRecipe) => void;
  initialFilters?: SearchFilters;
  viewMode?: 'grid' | 'list';
}

export const MarketplaceDiscovery: React.FC<MarketplaceDiscoveryProps> = ({
  onRecipeSelect,
  initialFilters = {},
  viewMode = 'grid'
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'discover' | 'trending' | 'featured'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [sortBy, setSortBy] = useState<'rating' | 'fork_count' | 'created_at' | 'popularity'>('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  
  const [recipes, setRecipes] = useState<MarketplaceRecipe[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Debounced search
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  // Load recipes
  const loadRecipes = useCallback(async (resetPage = false) => {
    setLoading(true);
    setError(null);
    
    try {
      const currentPage = resetPage ? 1 : page;
      const offset = (currentPage - 1) * limit;
      
      let response: SearchResponse;
      
      if (activeTab === 'trending') {
        response = await marketplaceApi.getTrendingRecipes({
          period: 'week',
          limit,
          ...filters
        });
      } else if (activeTab === 'featured') {
        response = await marketplaceApi.getFeaturedRecipes({
          limit,
          offset,
          ...filters
        });
      } else {
        response = await marketplaceApi.searchRecipes({
          q: debouncedSearch,
          filters,
          sort: sortBy,
          order: sortOrder,
          limit,
          offset
        });
      }
      
      if (resetPage) {
        setRecipes(response.items);
        setPage(1);
      } else {
        setRecipes(prev => page === 1 ? response.items : [...prev, ...response.items]);
      }
      
      setTotal(response.total);
      
      // Update suggestions if available
      if (response.suggestions) {
        setSuggestions(response.suggestions.map(s => s.text));
      }
    } catch (err) {
      setError(t('marketplace.error.loadRecipes'));
      console.error('Failed to load recipes:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, debouncedSearch, filters, sortBy, sortOrder, page, limit, t]);
  
  // Load recipes when dependencies change
  useEffect(() => {
    loadRecipes(true);
  }, [activeTab, debouncedSearch, filters, sortBy, sortOrder]);
  
  // Handle search input
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };
  
  // Handle filter changes
  const handleFilterChange = (newFilters: SearchFilters) => {
    setFilters(newFilters);
  };
  
  // Handle sort change
  const handleSortChange = (newSort: string) => {
    setSortBy(newSort as any);
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setActiveTab(newValue as any);
    setPage(1);
  };
  
  // Load more recipes (pagination)
  const loadMore = () => {
    if (!loading && recipes.length < total) {
      setPage(prev => prev + 1);
    }
  };
  
  // Get autocomplete suggestions
  const getAutocompleteSuggestions = async (inputValue: string) => {
    if (inputValue.length < 2) return [];
    
    try {
      const suggestions = await marketplaceApi.getAutocompleteSuggestions(inputValue);
      return suggestions.map(s => s.text);
    } catch (err) {
      console.error('Failed to get suggestions:', err);
      return [];
    }
  };
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {t('marketplace.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {t('marketplace.subtitle')}
        </Typography>
      </Box>
      
      {/* Navigation Tabs */}
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab 
          icon={<SearchIcon />} 
          label={t('marketplace.tabs.discover')} 
          value="discover" 
        />
        <Tab 
          icon={<TrendingIcon />} 
          label={t('marketplace.tabs.trending')} 
          value="trending" 
        />
        <Tab 
          icon={<StarIcon />} 
          label={t('marketplace.tabs.featured')} 
          value="featured" 
        />
      </Tabs>
      
      {/* Search and Filters */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Autocomplete
              freeSolo
              options={suggestions}
              inputValue={searchQuery}
              onInputChange={(event, newInputValue) => {
                setSearchQuery(newInputValue);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('marketplace.search.placeholder')}
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                  fullWidth
                />
              )}
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>{t('marketplace.sort.label')}</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                label={t('marketplace.sort.label')}
              >
                <MenuItem value="rating">{t('marketplace.sort.rating')}</MenuItem>
                <MenuItem value="popularity">{t('marketplace.sort.popularity')}</MenuItem>
                <MenuItem value="fork_count">{t('marketplace.sort.forks')}</MenuItem>
                <MenuItem value="created_at">{t('marketplace.sort.newest')}</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => setShowFilters(!showFilters)}
              fullWidth
            >
              {t('marketplace.filters.toggle')}
            </Button>
          </Grid>
        </Grid>
        
        {/* Advanced Filters */}
        {showFilters && (
          <Box sx={{ mt: 2 }}>
            <SearchFilters
              filters={filters}
              onChange={handleFilterChange}
            />
          </Box>
        )}
      </Box>
      
      {/* Results Summary */}
      {!loading && recipes.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {t('marketplace.results.found', { count: total, query: searchQuery })}
          </Typography>
        </Box>
      )}
      
      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {/* Loading State */}
      {loading && recipes.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <LoadingSpinner size={40} />
        </Box>
      )}
      
      {/* No Results */}
      {!loading && recipes.length === 0 && !error && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <RestaurantIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {t('marketplace.noResults.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('marketplace.noResults.subtitle')}
          </Typography>
          
          {suggestions.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                {t('marketplace.suggestions.title')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                {suggestions.slice(0, 5).map((suggestion, index) => (
                  <Chip
                    key={index}
                    label={suggestion}
                    onClick={() => setSearchQuery(suggestion)}
                    variant="outlined"
                    size="small"
                  />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      )}
      
      {/* Recipe Grid */}
      {recipes.length > 0 && (
        <>
          <Grid container spacing={3}>
            {recipes.map((recipe) => (
              <Grid 
                item 
                xs={12} 
                sm={viewMode === 'grid' ? 6 : 12} 
                md={viewMode === 'grid' ? 4 : 12} 
                lg={viewMode === 'grid' ? 3 : 12}
                key={recipe.id}
              >
                <RecipeCard
                  recipe={recipe}
                  onClick={() => onRecipeSelect?.(recipe)}
                  viewMode={viewMode}
                />
              </Grid>
            ))}
          </Grid>
          
          {/* Load More Button */}
          {recipes.length < total && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Button
                variant="outlined"
                onClick={loadMore}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : undefined}
              >
                {loading ? t('common.loading') : t('marketplace.loadMore')}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default MarketplaceDiscovery;
