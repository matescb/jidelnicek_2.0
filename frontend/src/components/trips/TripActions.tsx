import React from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
} from 'react';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  MoreVert as MoreVertIcon,
  People as PeopleIcon,
  Restaurant as RestaurantIcon,
  ShoppingCart as ShoppingCartIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { PermissionGate } from '../auth/PermissionGate';
import { PERMISSIONS } from '../../types/participants';
import { usePermissions } from '../../hooks/usePermissions';

interface TripActionsProps {
  tripId: string;
  onEdit?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  onManageParticipants?: () => void;
  onManageMeals?: () => void;
  onViewShopping?: () => void;
  onSettings?: () => void;
}

export const TripActions: React.FC<TripActionsProps> = ({
  tripId,
  onEdit,
  onDelete,
  onArchive,
  onManageParticipants,
  onManageMeals,
  onViewShopping,
  onSettings,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  
  const {
    canEditTrip,
    canDeleteTrip,
    canEditParticipants,
    canCreateMeals,
    canEditSettings,
  } = usePermissions();

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleAction = (action: (() => void) | undefined) => {
    handleClose();
    action?.();
  };

  return (
    <Box display="flex" gap={1} alignItems="center">
      {/* Quick Actions */}
      <ButtonGroup variant="outlined" size="small">
        <PermissionGate permissions={PERMISSIONS.PARTICIPANTS_VIEW}>
          <Button
            startIcon={<PeopleIcon />}
            onClick={onManageParticipants}
          >
            Participants
          </Button>
        </PermissionGate>
        
        <PermissionGate permissions={PERMISSIONS.MEALS_VIEW}>
          <Button
            startIcon={<RestaurantIcon />}
            onClick={onManageMeals}
          >
            Meals
          </Button>
        </PermissionGate>
        
        <PermissionGate permissions={PERMISSIONS.SHOPPING_VIEW}>
          <Button
            startIcon={<ShoppingCartIcon />}
            onClick={onViewShopping}
          >
            Shopping
          </Button>
        </PermissionGate>
      </ButtonGroup>

      {/* More Actions Menu */}
      <Tooltip title="More actions">
        <IconButton
          onClick={handleClick}
          size="small"
          aria-controls={open ? 'trip-actions-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
        >
          <MoreVertIcon />
        </IconButton>
      </Tooltip>
      
      <Menu
        id="trip-actions-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'trip-actions-button',
        }}
      >
        <PermissionGate permissions={PERMISSIONS.TRIP_EDIT} showError={false}>
          <MenuItem onClick={() => handleAction(onEdit)}>
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit Trip Details
          </MenuItem>
        </PermissionGate>
        
        <PermissionGate permissions={PERMISSIONS.SETTINGS_VIEW} showError={false}>
          <MenuItem onClick={() => handleAction(onSettings)}>
            <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
            Trip Settings
          </MenuItem>
        </PermissionGate>
        
        {(canEditTrip || canDeleteTrip) && <Divider />}
        
        <PermissionGate permissions={PERMISSIONS.TRIP_ARCHIVE} showError={false}>
          <MenuItem onClick={() => handleAction(onArchive)}>
            <ArchiveIcon fontSize="small" sx={{ mr: 1 }} />
            Archive Trip
          </MenuItem>
        </PermissionGate>
        
        <PermissionGate permissions={PERMISSIONS.TRIP_DELETE} showError={false}>
          <MenuItem onClick={() => handleAction(onDelete)} sx={{ color: 'error.main' }}>
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete Trip
          </MenuItem>
        </PermissionGate>
      </Menu>
    </Box>
  );
};