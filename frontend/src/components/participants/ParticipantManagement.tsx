import React, { useState } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  Paper,
} from 'react';
import {
  People as PeopleIcon,
  Security as SecurityIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material';
import { RoleManagement } from './RoleManagement';
import { PermissionGate } from '../auth/PermissionGate';
import { Participant, ParticipantRole, PERMISSIONS } from '../../types/participants';
import { usePermissions } from '../../hooks/usePermissions';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`participant-tabpanel-${index}`}
      aria-labelledby={`participant-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

interface ParticipantManagementProps {
  tripId: string;
  participants: Participant[];
  currentUserId: string;
  onRoleChange: (participantId: string, newRole: ParticipantRole) => Promise<void>;
  onBulkRoleChange?: (participantIds: string[], newRole: ParticipantRole) => Promise<void>;
  onInviteParticipant?: (email: string, role: ParticipantRole) => Promise<void>;
  onRemoveParticipant?: (participantId: string) => Promise<void>;
}

export const ParticipantManagement: React.FC<ParticipantManagementProps> = ({
  tripId,
  participants,
  currentUserId,
  onRoleChange,
  onBulkRoleChange,
  onInviteParticipant,
  onRemoveParticipant,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const { canAssignRoles, canInviteParticipants } = usePermissions();

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box>
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          aria-label="participant management tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<PeopleIcon />}
            label="Participants"
            iconPosition="start"
          />
          {canAssignRoles && (
            <Tab
              icon={<SecurityIcon />}
              label="Role Management"
              iconPosition="start"
            />
          )}
          {canInviteParticipants && (
            <Tab
              icon={<PersonAddIcon />}
              label="Invite"
              iconPosition="start"
            />
          )}
        </Tabs>
      </Paper>

      <TabPanel value={activeTab} index={0}>
        {/* Participants List Component would go here */}
        <Typography variant="h6" gutterBottom>
          Participants List
        </Typography>
        <Typography color="text.secondary">
          This would show the list of participants with their basic information.
        </Typography>
      </TabPanel>

      <PermissionGate permissions={PERMISSIONS.PARTICIPANTS_ASSIGN_ROLES}>
        <TabPanel value={activeTab} index={1}>
          <RoleManagement
            participants={participants}
            currentUserId={currentUserId}
            onRoleChange={onRoleChange}
            onBulkRoleChange={onBulkRoleChange}
          />
        </TabPanel>
      </PermissionGate>

      <PermissionGate permissions={PERMISSIONS.PARTICIPANTS_INVITE}>
        <TabPanel value={activeTab} index={2}>
          {/* Invite Component would go here */}
          <Typography variant="h6" gutterBottom>
            Invite Participants
          </Typography>
          <Typography color="text.secondary">
            This would show the invitation form.
          </Typography>
        </TabPanel>
      </PermissionGate>
    </Box>
  );
};