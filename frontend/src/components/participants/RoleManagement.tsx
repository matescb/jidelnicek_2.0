import React, { useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Checkbox,
  Tooltip,
  Grid,
  Alert,
  SelectChangeEvent,
  FormControlLabel,
} from '@mui/material';
import {
  Edit as EditIcon,
  Security as SecurityIcon,
  Group as GroupIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import {
  Participant,
  ParticipantRole,
  ROLE_PERMISSIONS,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
  PERMISSION_DETAILS,
  PERMISSIONS,
} from '../../types/participants';
import { usePermissions } from '../../hooks/usePermissions';

interface RoleManagementProps {
  participants: Participant[];
  currentUserId: string;
  onRoleChange: (participantId: string, newRole: ParticipantRole) => Promise<void>;
  onBulkRoleChange?: (participantIds: string[], newRole: ParticipantRole) => Promise<void>;
}

export const RoleManagement: React.FC<RoleManagementProps> = ({
  participants,
  currentUserId,
  onRoleChange,
  onBulkRoleChange,
}) => {
  const [selectedRole, setSelectedRole] = useState<ParticipantRole>('participant');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    participantId?: string;
    participantName?: string;
    newRole?: ParticipantRole;
    oldRole?: ParticipantRole;
  }>({ open: false });
  const [bulkSelection, setBulkSelection] = useState<string[]>([]);
  const [showPermissionMatrix, setShowPermissionMatrix] = useState(false);
  
  const { canAssignRoles } = usePermissions();
  
  const currentUserParticipant = participants.find(p => p.userId === currentUserId);
  const isCurrentUserOwner = currentUserParticipant?.role === 'owner';
  
  const permissionCategories = useMemo(() => {
    const categories = new Map<string, string[]>();
    Object.values(PERMISSION_DETAILS).forEach(permission => {
      if (!categories.has(permission.category)) {
        categories.set(permission.category, []);
      }
      categories.get(permission.category)!.push(permission.id);
    });
    return categories;
  }, []);
  
  const handleRoleChangeClick = (participant: Participant, newRole: ParticipantRole) => {
    if (participant.role === newRole) return;
    
    setConfirmDialog({
      open: true,
      participantId: participant.id,
      participantName: participant.name,
      newRole,
      oldRole: participant.role,
    });
  };
  
  const handleConfirmRoleChange = async () => {
    if (confirmDialog.participantId && confirmDialog.newRole) {
      try {
        await onRoleChange(confirmDialog.participantId, confirmDialog.newRole);
        setConfirmDialog({ open: false });
      } catch (error) {
        console.error('Failed to change role:', error);
      }
    }
  };
  
  const handleBulkRoleChange = async () => {
    if (bulkSelection.length === 0 || !onBulkRoleChange) return;
    
    try {
      await onBulkRoleChange(bulkSelection, selectedRole);
      setBulkSelection([]);
    } catch (error) {
      console.error('Failed to change roles in bulk:', error);
    }
  };
  
  const toggleBulkSelection = (participantId: string) => {
    setBulkSelection(prev =>
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    );
  };
  
  const selectAll = () => {
    const selectableIds = participants
      .filter(p => p.userId !== currentUserId && p.role !== 'owner')
      .map(p => p.id);
    setBulkSelection(selectableIds);
  };
  
  const getRoleChipColor = (role: ParticipantRole) => {
    switch (role) {
      case 'owner':
        return 'error';
      case 'organizer':
        return 'warning';
      case 'participant':
        return 'primary';
      case 'guest':
        return 'default';
      default:
        return 'default';
    }
  };
  
  if (!canAssignRoles) {
    return (
      <Alert severity="warning">
        You don't have permission to manage roles.
      </Alert>
    );
  }
  
  return (
    <Box>
      <Card>
        <CardHeader
          title={
            <Box display="flex" alignItems="center" gap={1}>
              <SecurityIcon />
              <Typography variant="h6">Role Management</Typography>
            </Box>
          }
          action={
            <Button
              variant="outlined"
              size="small"
              startIcon={<InfoIcon />}
              onClick={() => setShowPermissionMatrix(!showPermissionMatrix)}
            >
              {showPermissionMatrix ? 'Hide' : 'Show'} Permissions Matrix
            </Button>
          }
        />
        <CardContent>
          {/* Bulk Actions */}
          {onBulkRoleChange && bulkSelection.length > 0 && (
            <Box mb={3} p={2} bgcolor="action.selected" borderRadius={1}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2">
                    {bulkSelection.length} participant(s) selected
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Assign Role</InputLabel>
                    <Select
                      value={selectedRole}
                      onChange={(e: SelectChangeEvent) => setSelectedRole(e.target.value as ParticipantRole)}
                      label="Assign Role"
                    >
                      <MenuItem value="organizer">Organizer</MenuItem>
                      <MenuItem value="participant">Participant</MenuItem>
                      <MenuItem value="guest">Guest</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleBulkRoleChange}
                    disabled={bulkSelection.length === 0}
                  >
                    Apply to Selected
                  </Button>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {/* Participants Table */}
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  {onBulkRoleChange && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={
                          bulkSelection.length > 0 &&
                          bulkSelection.length < participants.filter(p => p.userId !== currentUserId && p.role !== 'owner').length
                        }
                        checked={
                          bulkSelection.length > 0 &&
                          bulkSelection.length === participants.filter(p => p.userId !== currentUserId && p.role !== 'owner').length
                        }
                        onChange={() => bulkSelection.length > 0 ? setBulkSelection([]) : selectAll()}
                      />
                    </TableCell>
                  )}
                  <TableCell>Participant</TableCell>
                  <TableCell>Current Role</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {participants.map((participant) => {
                  const isCurrentUser = participant.userId === currentUserId;
                  const canModify = !isCurrentUser && participant.role !== 'owner' && isCurrentUserOwner;
                  
                  return (
                    <TableRow key={participant.id}>
                      {onBulkRoleChange && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            disabled={!canModify}
                            checked={bulkSelection.includes(participant.id)}
                            onChange={() => toggleBulkSelection(participant.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body2">
                            {participant.name}
                            {isCurrentUser && (
                              <Chip
                                label="You"
                                size="small"
                                color="primary"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={ROLE_DISPLAY_NAMES[participant.role]}
                          color={getRoleChipColor(participant.role)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {participant.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={participant.status}
                          size="small"
                          variant="outlined"
                          color={participant.status === 'active' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="center">
                        {canModify ? (
                          <FormControl size="small" sx={{ minWidth: 120 }}>
                            <Select
                              value={participant.role}
                              onChange={(e) => handleRoleChangeClick(participant, e.target.value as ParticipantRole)}
                              displayEmpty
                            >
                              <MenuItem value="organizer">Organizer</MenuItem>
                              <MenuItem value="participant">Participant</MenuItem>
                              <MenuItem value="guest">Guest</MenuItem>
                            </Select>
                          </FormControl>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {participant.role === 'owner' ? 'Owner (cannot change)' : 'No permission'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Permissions Matrix */}
          {showPermissionMatrix && (
            <Box mt={4}>
              <Typography variant="h6" gutterBottom>
                Permissions Matrix
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Permission</TableCell>
                      <TableCell align="center">Owner</TableCell>
                      <TableCell align="center">Organizer</TableCell>
                      <TableCell align="center">Participant</TableCell>
                      <TableCell align="center">Guest</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.from(permissionCategories.entries()).map(([category, permissions]) => (
                      <React.Fragment key={category}>
                        <TableRow>
                          <TableCell colSpan={5} sx={{ bgcolor: 'action.hover', fontWeight: 'bold' }}>
                            {category.charAt(0).toUpperCase() + category.slice(1)}
                          </TableCell>
                        </TableRow>
                        {permissions.map((permissionId) => {
                          const permission = PERMISSION_DETAILS[permissionId];
                          return (
                            <TableRow key={permissionId}>
                              <TableCell>
                                <Box>
                                  <Typography variant="body2">{permission.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {permission.description}
                                  </Typography>
                                </Box>
                              </TableCell>
                              {(['owner', 'organizer', 'participant', 'guest'] as ParticipantRole[]).map((role) => (
                                <TableCell key={role} align="center">
                                  {ROLE_PERMISSIONS[role].includes(permissionId) ? (
                                    <CheckCircleIcon color="success" fontSize="small" />
                                  ) : (
                                    <CancelIcon color="disabled" fontSize="small" />
                                  )}
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {/* Role Descriptions */}
          <Box mt={4}>
            <Typography variant="h6" gutterBottom>
              Role Descriptions
            </Typography>
            <Grid container spacing={2}>
              {(Object.entries(ROLE_DESCRIPTIONS) as [ParticipantRole, string][]).map(([role, description]) => (
                <Grid item xs={12} sm={6} md={3} key={role}>
                  <Card variant="outlined">
                    <CardContent>
                      <Chip
                        label={ROLE_DISPLAY_NAMES[role]}
                        color={getRoleChipColor(role)}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                      <Typography variant="body2" color="text.secondary">
                        {description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </CardContent>
      </Card>
      
      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false })}>
        <DialogTitle>Confirm Role Change</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to change {confirmDialog.participantName}'s role from{' '}
            <strong>{confirmDialog.oldRole && ROLE_DISPLAY_NAMES[confirmDialog.oldRole]}</strong> to{' '}
            <strong>{confirmDialog.newRole && ROLE_DISPLAY_NAMES[confirmDialog.newRole]}</strong>?
          </DialogContentText>
          {confirmDialog.newRole === 'guest' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Guests have limited access and can only view trip information.
            </Alert>
          )}
          {confirmDialog.newRole === 'organizer' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Organizers can manage participants, meals, and edit trip details.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false })}>Cancel</Button>
          <Button onClick={handleConfirmRoleChange} color="primary" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};