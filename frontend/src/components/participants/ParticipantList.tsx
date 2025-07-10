import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Users,
  AlertCircle,
  Loader2,
  Filter,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Mail,
  UserPlus,
} from 'lucide-react';
import { useTripStore } from '@/store/slices/tripStore';
import { TripParticipant } from '@/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';

type SortField = 'name' | 'email' | 'role' | 'status' | 'mealCoefficient' | 'snackCoefficient';
type SortDirection = 'asc' | 'desc';

interface ParticipantListProps {
  onAddParticipant?: () => void;
  onEditParticipant?: (participant: TripParticipant) => void;
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  onAddParticipant,
  onEditParticipant,
}) => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { trips, loading, error, removeParticipant, updateParticipant } = useTripStore();
  const { showToast } = useToast();
  
  const trip = trips.find(t => t.id === tripId);
  const participants = trip?.participants || [];

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Reset selection when participants change
  useEffect(() => {
    setSelectedParticipants(new Set());
  }, [participants]);

  // Filtered and sorted participants
  const filteredParticipants = useMemo(() => {
    return participants.filter(participant => {
      const matchesSearch = searchQuery === '' || 
        participant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        participant.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || participant.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || participant.status === statusFilter;
      
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [participants, searchQuery, roleFilter, statusFilter]);

  const sortedParticipants = useMemo(() => {
    const sorted = [...filteredParticipants].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];
      
      if (sortField === 'name' || sortField === 'email' || sortField === 'role' || sortField === 'status') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [filteredParticipants, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedParticipants.length / itemsPerPage);
  const paginatedParticipants = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedParticipants.slice(start, end);
  }, [sortedParticipants, currentPage, itemsPerPage]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedParticipants.size === paginatedParticipants.length) {
      setSelectedParticipants(new Set());
    } else {
      setSelectedParticipants(new Set(paginatedParticipants.map(p => p.id)));
    }
  };

  const handleSelectParticipant = (id: string) => {
    const newSelected = new Set(selectedParticipants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedParticipants(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (!tripId) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${selectedParticipants.size} participant(s)?`
    );
    
    if (!confirmDelete) return;
    
    try {
      for (const participantId of selectedParticipants) {
        await removeParticipant(tripId, participantId);
      }
      showToast({
        title: 'Success',
        description: `Deleted ${selectedParticipants.size} participant(s)`,
        type: 'success'
      });
      setSelectedParticipants(new Set());
    } catch (error) {
      showToast({
        title: 'Error',
        description: 'Failed to delete participants',
        type: 'error'
      });
    }
  };

  const handleExportSelected = async () => {
    setIsExporting(true);
    try {
      const selectedData = participants.filter(p => selectedParticipants.has(p.id));
      const csv = [
        ['Name', 'Email', 'Role', 'Status', 'Meal Coefficient', 'Snack Coefficient'],
        ...selectedData.map(p => [
          p.name,
          p.email,
          p.role,
          p.status,
          p.mealCoefficient.toString(),
          p.snackCoefficient.toString(),
        ]),
      ].map(row => row.join(',')).join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participants-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      
      showToast({
        title: 'Success',
        description: 'Participants exported successfully',
        type: 'success'
      });
    } catch (error) {
      showToast({
        title: 'Error',
        description: 'Failed to export participants',
        type: 'error'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleChangeRole = async (newRole: 'planner' | 'participant') => {
    if (!tripId) return;
    
    try {
      for (const participantId of selectedParticipants) {
        const participant = participants.find(p => p.id === participantId);
        if (participant) {
          await updateParticipant(tripId, participantId, { role: newRole });
        }
      }
      showToast({
        title: 'Success',
        description: `Updated role for ${selectedParticipants.size} participant(s)`,
        type: 'success'
      });
      setSelectedParticipants(new Set());
    } catch (error) {
      showToast({
        title: 'Error',
        description: 'Failed to update roles',
        type: 'error'
      });
    }
  };

  const handleDeleteParticipant = async (participant: TripParticipant) => {
    if (!tripId) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to remove ${participant.name} from this trip?`
    );
    
    if (!confirmDelete) return;
    
    try {
      await removeParticipant(tripId, participant.id);
      showToast({
        title: 'Success',
        description: 'Participant removed successfully',
        type: 'success'
      });
    } catch (error) {
      showToast({
        title: 'Error',
        description: 'Failed to remove participant',
        type: 'error'
      });
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        setCurrentPage(prev => prev + 1);
      } else if (e.key === 'Escape') {
        setSelectedParticipants(new Set());
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error loading participants</h3>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  // Empty state
  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Users className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No participants yet</h3>
        <p className="text-gray-600 mb-6">Add participants to start planning your trip</p>
        <button
          onClick={onAddParticipant}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add First Participant
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-semibold text-gray-900">Participants</h2>
        <button
          onClick={onAddParticipant}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Participant
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "inline-flex items-center px-4 py-2 border rounded-lg text-sm font-medium transition-colors",
                showFilters
                  ? "border-blue-500 text-blue-700 bg-blue-50"
                  : "border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              )}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {(roleFilter !== 'all' || statusFilter !== 'all') && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded-full">
                  {[roleFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length}
                </span>
              )}
            </button>
            
            {selectedParticipants.size > 0 && (
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Check className="h-4 w-4 mr-2" />
                {selectedParticipants.size} selected
              </button>
            )}
          </div>
        </div>

        {/* Filter Options */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role
              </label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="planner">Planner</option>
                <option value="participant">Participant</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
              </select>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {showBulkActions && selectedParticipants.size > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
            <button
              onClick={handleDeleteSelected}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </button>
            <button
              onClick={handleExportSelected}
              disabled={isExporting}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              Export
            </button>
            <div className="relative inline-block">
              <button
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                <Users className="h-4 w-4 mr-1.5" />
                Change Role
              </button>
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-10">
                <button
                  onClick={() => handleChangeRole('planner')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Set as Planner
                </button>
                <button
                  onClick={() => handleChangeRole('participant')}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Set as Participant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table for desktop */}
      <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.size === paginatedParticipants.length && paginatedParticipants.length > 0}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Name
                    {sortField === 'name' && (
                      sortDirection === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('email')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Email
                    {sortField === 'email' && (
                      sortDirection === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('role')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Role
                    {sortField === 'role' && (
                      sortDirection === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('status')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Status
                    {sortField === 'status' && (
                      sortDirection === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('mealCoefficient')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Meal Coef.
                    {sortField === 'mealCoefficient' && (
                      sortDirection === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('snackCoefficient')}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center">
                    Snack Coef.
                    {sortField === 'snackCoefficient' && (
                      sortDirection === 'asc' ? 
                        <ChevronUp className="ml-1 h-4 w-4" /> : 
                        <ChevronDown className="ml-1 h-4 w-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedParticipants.map((participant) => (
                <tr
                  key={participant.id}
                  className={cn(
                    "hover:bg-gray-50",
                    selectedParticipants.has(participant.id) && "bg-blue-50"
                  )}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedParticipants.has(participant.id)}
                      onChange={() => handleSelectParticipant(participant.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{participant.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                      participant.role === 'planner'
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
                    )}>
                      {participant.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn(
                      "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                      participant.status === 'accepted' && "bg-green-100 text-green-800",
                      participant.status === 'pending' && "bg-yellow-100 text-yellow-800",
                      participant.status === 'declined' && "bg-red-100 text-red-800"
                    )}>
                      {participant.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {participant.mealCoefficient}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {participant.snackCoefficient}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEditParticipant?.(participant)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteParticipant(participant)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards for mobile */}
      <div className="block lg:hidden space-y-4">
        {paginatedParticipants.map((participant) => (
          <div
            key={participant.id}
            className={cn(
              "bg-white rounded-lg shadow-sm border p-4",
              selectedParticipants.has(participant.id)
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-start">
                <input
                  type="checkbox"
                  checked={selectedParticipants.has(participant.id)}
                  onChange={() => handleSelectParticipant(participant.id)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1 mr-3"
                />
                <div>
                  <h3 className="text-base font-medium text-gray-900">{participant.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center mt-1">
                    <Mail className="h-4 w-4 mr-1" />
                    {participant.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditParticipant?.(participant)}
                  className="text-blue-600 hover:text-blue-900"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDeleteParticipant(participant)}
                  className="text-red-600 hover:text-red-900"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Role:</span>
                <span className={cn(
                  "ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                  participant.role === 'planner'
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-800"
                )}>
                  {participant.role}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={cn(
                  "ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                  participant.status === 'accepted' && "bg-green-100 text-green-800",
                  participant.status === 'pending' && "bg-yellow-100 text-yellow-800",
                  participant.status === 'declined' && "bg-red-100 text-red-800"
                )}>
                  {participant.status}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Meal:</span>
                <span className="ml-2 font-medium">{participant.mealCoefficient}</span>
              </div>
              <div>
                <span className="text-gray-500">Snack:</span>
                <span className="ml-2 font-medium">{participant.snackCoefficient}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>
                {' '}to{' '}
                <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, sortedParticipants.length)}
                </span>
                {' '}of{' '}
                <span className="font-medium">{sortedParticipants.length}</span>
                {' '}results
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={50}>50 per page</option>
              </select>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    if (currentPage <= 3 && page <= 5) return true;
                    if (currentPage >= totalPages - 2 && page >= totalPages - 4) return true;
                    return false;
                  })
                  .map((page, index, array) => (
                    <React.Fragment key={page}>
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          ...
                        </span>
                      )}
                      <button
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "relative inline-flex items-center px-4 py-2 border text-sm font-medium",
                          currentPage === page
                            ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                            : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                        )}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};