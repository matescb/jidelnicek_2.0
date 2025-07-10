import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  IconButton,
  Chip,
  Button,
  Tooltip,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { PermissionGate, OrganizerOnly } from '../auth/PermissionGate';
import { PERMISSIONS } from '../../types/participants';
import { usePermissions } from '../../hooks/usePermissions';

interface MealCardProps {
  meal: {
    id: string;
    name: string;
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    date: string;
    assignedCook?: {
      id: string;
      name: string;
    };
    servings: number;
    recipe?: {
      id: string;
      name: string;
      prepTime: number;
      cookTime: number;
    };
  };
  onEdit?: () => void;
  onDelete?: () => void;
  onAssignCook?: () => void;
  onViewRecipe?: () => void;
}

export const MealCard: React.FC<MealCardProps> = ({
  meal,
  onEdit,
  onDelete,
  onAssignCook,
  onViewRecipe,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { canEditMeals, canDeleteMeals, canAssignCooks } = usePermissions();
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleAction = (action: (() => void) | undefined) => {
    handleMenuClose();
    action?.();
  };
  
  const getMealTypeColor = (type: string) => {
    switch (type) {
      case 'breakfast':
        return 'warning';
      case 'lunch':
        return 'primary';
      case 'dinner':
        return 'secondary';
      case 'snack':
        return 'default';
      default:
        return 'default';
    }
  };
  
  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" gutterBottom>
              {meal.name}
            </Typography>
            <Chip
              label={meal.type}
              size="small"
              color={getMealTypeColor(meal.type)}
              sx={{ mb: 1 }}
            />
          </Box>
          
          {/* Action Menu - Only show if user has any meal permissions */}
          <PermissionGate
            permissions={[
              PERMISSIONS.MEALS_EDIT,
              PERMISSIONS.MEALS_DELETE,
              PERMISSIONS.MEALS_ASSIGN_COOKS,
            ]}
            showError={false}
          >
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          </PermissionGate>
        </Box>
        
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {new Date(meal.date).toLocaleDateString()} • {meal.servings} servings
        </Typography>
        
        {meal.recipe && (
          <Box mt={1}>
            <Typography variant="body2">
              Recipe: {meal.recipe.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Prep: {meal.recipe.prepTime}min • Cook: {meal.recipe.cookTime}min
            </Typography>
          </Box>
        )}
        
        {meal.assignedCook && (
          <Box display="flex" alignItems="center" gap={0.5} mt={2}>
            <PersonIcon fontSize="small" color="action" />
            <Typography variant="body2">
              Cook: {meal.assignedCook.name}
            </Typography>
          </Box>
        )}
      </CardContent>
      
      <CardActions>
        <Button size="small" onClick={onViewRecipe}>
          View Recipe
        </Button>
        
        {/* Assign Cook Button - Only for organizers */}
        <OrganizerOnly>
          {!meal.assignedCook && (
            <Button
              size="small"
              color="primary"
              onClick={onAssignCook}
              startIcon={<PersonIcon />}
            >
              Assign Cook
            </Button>
          )}
        </OrganizerOnly>
      </CardActions>
      
      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <PermissionGate permissions={PERMISSIONS.MEALS_EDIT} showError={false}>
          <MenuItem onClick={() => handleAction(onEdit)}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit Meal
          </MenuItem>
        </PermissionGate>
        
        <PermissionGate permissions={PERMISSIONS.MEALS_ASSIGN_COOKS} showError={false}>
          <MenuItem onClick={() => handleAction(onAssignCook)}>
            <PersonIcon fontSize="small" sx={{ mr: 1 }} />
            {meal.assignedCook ? 'Change Cook' : 'Assign Cook'}
          </MenuItem>
        </PermissionGate>
        
        <PermissionGate permissions={PERMISSIONS.MEALS_DELETE} showError={false}>
          <MenuItem onClick={() => handleAction(onDelete)} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete Meal
          </MenuItem>
        </PermissionGate>
      </Menu>
    </Card>
  );
};