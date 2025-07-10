import React, { useEffect, useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Search,
  Filter,
  UserPlus,
  Download,
  Mail,
  Shield,
  UserX,
  MoreVertical,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCcw,
  Users,
  Activity
} from 'lucide-react';
import { useAdminStore } from '../../store/slices/adminStore';
import { useToastStore } from '../../store/slices/toastStore';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';

export interface UserListViewProps {
  className?: string;
}

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
}

interface UserActivityDialogProps {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}

const InviteUserDialog: React.FC<InviteUserDialogProps> = ({ open, onClose }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [loading, setLoading] = useState(false);
  
  const { inviteUser } = useAdminStore();
  const { addToast } = useToastStore();

  const handleInvite = async () => {
    if (!email) return;

    setLoading(true);
    try {
      await inviteUser(email, role);
      addToast({
        type: 'success',
        title: 'Invitation sent',
        message: `Invitation sent to ${email}`
      });
      setEmail('');
      onClose();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Failed to send invitation',
        message: error instanceof Error ? error.message : 'Something went wrong'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            Send an invitation to a new user to join the platform.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium mb-1 block">
              Email Address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="role" className="text-sm font-medium mb-1 block">
              Role
            </label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as 'user' | 'admin')}
              disabled={loading}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={loading || !email}>
            {loading ? (
              <>
                <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send Invitation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const UserActivityDialog: React.FC<UserActivityDialogProps> = ({ userId, open, onClose }) => {
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const { fetchUserActivity } = useAdminStore();

  useEffect(() => {
    if (open && userId) {
      setLoading(true);
      fetchUserActivity(userId)
        .then(setActivity)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, userId, fetchUserActivity]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>User Activity</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : activity ? (
          <Tabs defaultValue="trips">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trips">Trips ({activity.trips?.length || 0})</TabsTrigger>
              <TabsTrigger value="recipes">Recipes ({activity.recipes?.length || 0})</TabsTrigger>
              <TabsTrigger value="actions">Recent Actions</TabsTrigger>
            </TabsList>
            <TabsContent value="trips" className="space-y-2 max-h-96 overflow-y-auto">
              {activity.trips?.length > 0 ? (
                activity.trips.map((trip: any) => (
                  <Card key={trip.id} className="p-3">
                    <div className="font-medium">{trip.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(trip.startDate), 'PP')} - {format(new Date(trip.endDate), 'PP')}
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No trips created</p>
              )}
            </TabsContent>
            <TabsContent value="recipes" className="space-y-2 max-h-96 overflow-y-auto">
              {activity.recipes?.length > 0 ? (
                activity.recipes.map((recipe: any) => (
                  <Card key={recipe.id} className="p-3">
                    <div className="font-medium">{recipe.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Added {format(new Date(recipe.createdAt), 'PP')}
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No recipes added</p>
              )}
            </TabsContent>
            <TabsContent value="actions" className="space-y-2 max-h-96 overflow-y-auto">
              {activity.lastActions?.length > 0 ? (
                activity.lastActions.map((action: any, index: number) => (
                  <Card key={index} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{action.type}</div>
                        <div className="text-sm text-muted-foreground">{action.description}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(action.timestamp), 'Pp')}
                      </div>
                    </div>
                  </Card>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No recent actions</p>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <p className="text-center text-muted-foreground py-8">Failed to load activity</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const UserListView: React.FC<UserListViewProps> = ({ className }) => {
  const {
    users,
    totalUsers,
    currentPage,
    pageSize,
    filters,
    sort,
    selectedUsers,
    loading,
    error,
    fetchUsers,
    setFilters,
    setSort,
    toggleUserSelection,
    selectAllUsers,
    setCurrentPage,
    performBulkAction,
    exportUsers,
    suspendUser,
    activateUser,
    changeUserRole,
    resendInvitation,
    deleteUser
  } = useAdminStore();

  const { addToast } = useToastStore();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bulkActionDialogOpen, setBulkActionDialogOpen] = useState(false);
  const [selectedBulkAction, setSelectedBulkAction] = useState<string>('');

  // Initial load
  useEffect(() => {
    fetchUsers();
  }, []);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters({ search: searchTerm });
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchTerm, setFilters]);

  // Calculate pagination
  const totalPages = Math.ceil(totalUsers / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalUsers);

  // User stats
  const stats = useMemo(() => {
    return {
      total: totalUsers,
      active: users.filter(u => u.status === 'active').length,
      suspended: users.filter(u => u.status === 'suspended').length,
      admins: users.filter(u => u.role === 'admin').length,
      unverified: users.filter(u => !u.emailVerified).length
    };
  }, [users, totalUsers]);

  const handleQuickAction = async (action: string, userId: string) => {
    try {
      switch (action) {
        case 'suspend':
          await suspendUser(userId);
          addToast({ type: 'success', title: 'User suspended' });
          break;
        case 'activate':
          await activateUser(userId);
          addToast({ type: 'success', title: 'User activated' });
          break;
        case 'makeAdmin':
          await changeUserRole(userId, 'admin');
          addToast({ type: 'success', title: 'User promoted to admin' });
          break;
        case 'makeUser':
          await changeUserRole(userId, 'user');
          addToast({ type: 'success', title: 'User role changed' });
          break;
        case 'resendInvite':
          await resendInvitation(userId);
          addToast({ type: 'success', title: 'Invitation resent' });
          break;
        case 'delete':
          if (window.confirm('Are you sure you want to delete this user?')) {
            await deleteUser(userId);
            addToast({ type: 'success', title: 'User deleted' });
          }
          break;
        case 'viewActivity':
          setSelectedUserId(userId);
          setActivityDialogOpen(true);
          break;
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Action failed',
        message: error instanceof Error ? error.message : 'Something went wrong'
      });
    }
  };

  const handleBulkAction = async () => {
    if (!selectedBulkAction || selectedUsers.length === 0) return;

    try {
      await performBulkAction(selectedBulkAction as any, selectedUsers);
      addToast({
        type: 'success',
        title: 'Bulk action completed',
        message: `Action performed on ${selectedUsers.length} users`
      });
      setBulkActionDialogOpen(false);
      setSelectedBulkAction('');
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Bulk action failed',
        message: error instanceof Error ? error.message : 'Something went wrong'
      });
    }
  };

  const handleExport = async () => {
    try {
      await exportUsers(selectedUsers.length > 0 ? selectedUsers : undefined);
      addToast({ type: 'success', title: 'Export started' });
    } catch (error) {
      addToast({ type: 'error', title: 'Export failed' });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'suspended':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'inactive':
        return <Clock className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getRoleBadgeVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    return role === 'admin' ? 'destructive' : 'secondary';
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">Manage users, roles, and permissions</p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suspended</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.suspended}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Admins</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.admins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unverified</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.unverified}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Users</CardTitle>
            <div className="flex items-center gap-2">
              {selectedUsers.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBulkActionDialogOpen(true);
                    }}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Bulk Actions ({selectedUsers.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectAllUsers(false)}
                  >
                    Clear Selection
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchUsers()}
                disabled={loading}
              >
                <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={filters.role || ''}
              onValueChange={(value) => setFilters({ role: value as any })}
              className="w-[150px]"
            >
              <option value="">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </Select>
            <Select
              value={filters.status || ''}
              onValueChange={(value) => setFilters({ status: value as any })}
              className="w-[150px]"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
            </Select>
            <Select
              value={filters.emailVerified === null ? '' : String(filters.emailVerified)}
              onValueChange={(value) => setFilters({ 
                emailVerified: value === '' ? null : value === 'true' 
              })}
              className="w-[150px]"
            >
              <option value="">All Verification</option>
              <option value="true">Verified</option>
              <option value="false">Unverified</option>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left">
                    <Checkbox
                      checked={selectedUsers.length === users.length && users.length > 0}
                      onCheckedChange={(checked) => selectAllUsers(!!checked)}
                    />
                  </th>
                  <th
                    className="p-3 text-left font-medium cursor-pointer hover:bg-muted/100"
                    onClick={() => setSort({
                      field: 'name',
                      direction: sort.field === 'name' && sort.direction === 'asc' ? 'desc' : 'asc'
                    })}
                  >
                    User
                  </th>
                  <th
                    className="p-3 text-left font-medium cursor-pointer hover:bg-muted/100"
                    onClick={() => setSort({
                      field: 'email',
                      direction: sort.field === 'email' && sort.direction === 'asc' ? 'desc' : 'asc'
                    })}
                  >
                    Email
                  </th>
                  <th className="p-3 text-left font-medium">Role</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th
                    className="p-3 text-left font-medium cursor-pointer hover:bg-muted/100"
                    onClick={() => setSort({
                      field: 'lastLogin',
                      direction: sort.field === 'lastLogin' && sort.direction === 'asc' ? 'desc' : 'asc'
                    })}
                  >
                    Last Login
                  </th>
                  <th className="p-3 text-left font-medium">Activity</th>
                  <th className="p-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium">
                              {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">
                              {user.firstName && user.lastName
                                ? `${user.firstName} ${user.lastName}`
                                : user.email.split('@')[0]}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{user.email}</span>
                          {!user.emailVerified && (
                            <Badge variant="outline" className="text-xs">
                              Unverified
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role === 'admin' && <Shield className="mr-1 h-3 w-3" />}
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(user.status)}
                          <span className="capitalize">{user.status}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {user.lastLogin ? (
                          <div>
                            <div className="text-sm">
                              {format(new Date(user.lastLogin), 'PP')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(user.lastLogin), 'p')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span>{user.tripsCreated || 0}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span>{user.recipesAdded || 0}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[200px]">
                            <DropdownMenuItem onClick={() => handleQuickAction('viewActivity', user.id)}>
                              <Activity className="mr-2 h-4 w-4" />
                              View Activity
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.status === 'active' ? (
                              <DropdownMenuItem onClick={() => handleQuickAction('suspend', user.id)}>
                                <UserX className="mr-2 h-4 w-4" />
                                Suspend User
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleQuickAction('activate', user.id)}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Activate User
                              </DropdownMenuItem>
                            )}
                            {user.role === 'user' ? (
                              <DropdownMenuItem onClick={() => handleQuickAction('makeAdmin', user.id)}>
                                <Shield className="mr-2 h-4 w-4" />
                                Make Admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleQuickAction('makeUser', user.id)}>
                                <Users className="mr-2 h-4 w-4" />
                                Remove Admin
                              </DropdownMenuItem>
                            )}
                            {user.invitationToken && (
                              <DropdownMenuItem onClick={() => handleQuickAction('resendInvite', user.id)}>
                                <Mail className="mr-2 h-4 w-4" />
                                Resend Invitation
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleQuickAction('delete', user.id)}
                              className="text-red-600"
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex} to {endIndex} of {totalUsers} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = currentPage > 3 ? currentPage - 2 + i : i + 1;
                  if (page > totalPages) return null;
                  return (
                    <Button
                      key={page}
                      variant={page === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <InviteUserDialog open={inviteDialogOpen} onClose={() => setInviteDialogOpen(false)} />
      <UserActivityDialog 
        userId={selectedUserId} 
        open={activityDialogOpen} 
        onClose={() => {
          setActivityDialogOpen(false);
          setSelectedUserId(null);
        }} 
      />

      {/* Bulk Action Dialog */}
      <Dialog open={bulkActionDialogOpen} onOpenChange={setBulkActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Action</DialogTitle>
            <DialogDescription>
              Apply this action to {selectedUsers.length} selected users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select
              value={selectedBulkAction}
              onValueChange={setSelectedBulkAction}
            >
              <option value="">Select an action</option>
              <option value="activate">Activate Users</option>
              <option value="deactivate">Deactivate Users</option>
              <option value="changeRole">Change Role</option>
              <option value="delete">Delete Users</option>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleBulkAction} 
              disabled={!selectedBulkAction}
              variant={selectedBulkAction === 'delete' ? 'destructive' : 'default'}
            >
              Apply Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserListView;