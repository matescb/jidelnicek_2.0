import React from 'react';
import { Box, Alert, Typography } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { Participant } from '../../types/participants';

interface PermissionGateProps {
  children: React.ReactNode;
  permissions?: string | string[];
  requireAll?: boolean;
  participant?: Participant;
  fallback?: React.ReactNode;
  showError?: boolean;
}

export const PermissionGate: React.FC<PermissionGateProps> = ({
  children,
  permissions,
  requireAll = false,
  participant,
  fallback,
  showError = true,
}) => {
  const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermissions({ participant });
  
  // If no permissions specified, render children
  if (!permissions) {
    return <>{children}</>;
  }
  
  // Check permissions
  const permissionArray = Array.isArray(permissions) ? permissions : [permissions];
  const hasAccess = permissionArray.length === 1
    ? hasPermission(permissionArray[0])
    : requireAll
    ? hasAllPermissions(permissionArray)
    : hasAnyPermission(permissionArray);
  
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Handle no access
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (showError) {
    return (
      <Box p={2}>
        <Alert severity="warning">
          <Typography variant="body2">
            You don't have permission to access this feature.
          </Typography>
        </Alert>
      </Box>
    );
  }
  
  return null;
};

// Convenience components for common permission checks
export const OwnerOnly: React.FC<{ children: React.ReactNode; participant?: Participant }> = ({ 
  children, 
  participant 
}) => {
  const { isOwner } = usePermissions({ participant });
  return isOwner ? <>{children}</> : null;
};

export const OrganizerOnly: React.FC<{ children: React.ReactNode; participant?: Participant }> = ({ 
  children, 
  participant 
}) => {
  const { isOrganizer } = usePermissions({ participant });
  return isOrganizer ? <>{children}</> : null;
};

export const ParticipantOnly: React.FC<{ children: React.ReactNode; participant?: Participant }> = ({ 
  children, 
  participant 
}) => {
  const { isParticipant } = usePermissions({ participant });
  return isParticipant ? <>{children}</> : null;
};