import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Avatar,
  Typography,
  Box,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  MoreVert,
  Email,
  Phone,
  Edit,
  Delete,
  AdminPanelSettings,
  Restaurant,
  ShoppingCart,
} from '@mui/icons-material';
import { StatusIndicator } from './StatusIndicator';
import { TripParticipant } from '@/types';

export interface ParticipantCardProps {
  participant: TripParticipant;
  isOnline?: boolean;
  lastSeen?: Date;
  currentActivity?: string;
  onEdit?: (participant: TripParticipant) => void;
  onDelete?: (participant: TripParticipant) => void;
  onRoleChange?: (participant: TripParticipant, newRole: 'planner' | 'participant') => void;
  showActions?: boolean;
  compact?: boolean;
}

export const ParticipantCard: React.FC<ParticipantCardProps> = ({
  participant,
  isOnline = false,
  lastSeen,
  currentActivity,
  onEdit,
  onDelete,
  onRoleChange,
  showActions = true,
  compact = false,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'planner':
        return 'secondary';
      case 'organizer':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'success';
      case 'pending':
        return 'warning';
      case 'declined':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s',
        '&:hover': {
          boxShadow: theme.shadows[4],
        },
      }}
    >
      <CardHeader
        avatar={
          <Box sx={{ position: 'relative' }}>
            <Avatar
              sx={{
                bgcolor: theme.palette.primary.main,
                width: compact ? 40 : 56,
                height: compact ? 40 : 56,
              }}
            >
              {participant.name.charAt(0).toUpperCase()}
            </Avatar>
            <Box
              sx={{
                position: 'absolute',
                bottom: -2,
                right: -2,
              }}
            >
              <StatusIndicator
                isOnline={isOnline}
                lastSeen={lastSeen}
                size="small"
              />
            </Box>
          </Box>
        }
        action={
          showActions && (
            <IconButton onClick={handleMenuOpen}>
              <MoreVert />
            </IconButton>
          )
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant={compact ? 'body1' : 'h6'}>
              {participant.name}
            </Typography>
            {currentActivity && (
              <Typography variant="caption" color="text.secondary">
                • {currentActivity}
              </Typography>
            )}
          </Box>
        }
        subheader={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <Chip
              label={participant.role}
              size="small"
              color={getRoleColor(participant.role)}
              icon={participant.role === 'planner' ? <AdminPanelSettings /> : undefined}
            />
            <Chip
              label={participant.status}
              size="small"
              variant="outlined"
              color={getStatusColor(participant.status)}
            />
          </Box>
        }
      />

      <CardContent sx={{ flexGrow: 1, pt: 0 }}>
        {participant.email && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Email fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {participant.email}
            </Typography>
          </Box>
        )}

        {participant.phoneNumber && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Phone fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {participant.phoneNumber}
            </Typography>
          </Box>
        )}

        {!compact && (
          <>
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Meal Coefficients
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Tooltip title="Meal coefficient">
                  <Chip
                    icon={<Restaurant />}
                    label={participant.mealCoefficient}
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
                <Tooltip title="Snack coefficient">
                  <Chip
                    icon={<ShoppingCart />}
                    label={participant.snackCoefficient}
                    size="small"
                    variant="outlined"
                  />
                </Tooltip>
              </Box>
            </Box>

            {participant.dietaryRestrictions && participant.dietaryRestrictions.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Dietary Restrictions
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {participant.dietaryRestrictions.map((restriction, index) => (
                    <Chip
                      key={index}
                      label={restriction}
                      size="small"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {participant.notes && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Notes
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {participant.notes}
                </Typography>
              </Box>
            )}
          </>
        )}
      </CardContent>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {onEdit && (
          <MenuItem
            onClick={() => {
              onEdit(participant);
              handleMenuClose();
            }}
          >
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {onRoleChange && participant.role !== 'planner' && (
          <MenuItem
            onClick={() => {
              onRoleChange(participant, 'planner');
              handleMenuClose();
            }}
          >
            <AdminPanelSettings fontSize="small" sx={{ mr: 1 }} />
            Make Planner
          </MenuItem>
        )}
        {onRoleChange && participant.role === 'planner' && (
          <MenuItem
            onClick={() => {
              onRoleChange(participant, 'participant');
              handleMenuClose();
            }}
          >
            <AdminPanelSettings fontSize="small" sx={{ mr: 1 }} />
            Make Participant
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem
            onClick={() => {
              onDelete(participant);
              handleMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Remove
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default ParticipantCard;