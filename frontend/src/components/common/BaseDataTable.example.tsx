import React, { useState } from 'react';
import { BaseDataTable, Column } from './BaseDataTable';
import { Badge, Button } from '../ui';
import { Edit, Trash2, User } from 'lucide-react';

// Example data type
interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'moderator';
  status: 'active' | 'inactive' | 'pending';
  joinDate: Date;
  lastLogin: Date;
  posts: number;
}

// Generate sample data
const generateUsers = (count: number): User[] => {
  const roles: User['role'][] = ['admin', 'user', 'moderator'];
  const statuses: User['status'][] = ['active', 'inactive', 'pending'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `User ${i + 1}`,
    email: `user${i + 1}@example.com`,
    role: roles[Math.floor(Math.random() * roles.length)],
    status: statuses[Math.floor(Math.random() * statuses.length)],
    joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    lastLogin: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    posts: Math.floor(Math.random() * 100),
  }));
};

export function BaseDataTableExample() {
  const [users] = useState<User[]>(generateUsers(100));
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [loading, setLoading] = useState(false);

  // Column definitions with all features
  const columns: Column<User>[] = [
    {
      key: 'id',
      header: 'ID',
      sortable: true,
      width: '80px',
      sticky: true,
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      filterable: true,
      render: (value, user) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortable: true,
      filterable: true,
      render: (value) => (
        <a href={`mailto:${value}`} className="text-blue-600 hover:underline">
          {value}
        </a>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      sortable: true,
      render: (value: User['role']) => {
        const colors = {
          admin: 'bg-red-100 text-red-800',
          user: 'bg-blue-100 text-blue-800',
          moderator: 'bg-green-100 text-green-800',
        };
        return (
          <Badge className={colors[value]}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (value: User['status']) => {
        const colors = {
          active: 'bg-green-100 text-green-800',
          inactive: 'bg-gray-100 text-gray-800',
          pending: 'bg-yellow-100 text-yellow-800',
        };
        return (
          <Badge className={colors[value]}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'joinDate',
      header: 'Join Date',
      sortable: true,
      accessor: (user) => user.joinDate,
      render: (value: Date) => value.toLocaleDateString(),
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      sortable: true,
      accessor: (user) => user.lastLogin,
      render: (value: Date) => {
        const days = Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24));
        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        return `${days} days ago`;
      },
    },
    {
      key: 'posts',
      header: 'Posts',
      sortable: true,
      render: (value) => (
        <span className="font-mono">{value}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      filterable: false,
      render: (_, user) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('Edit user:', user);
            }}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              console.log('Delete user:', user);
            }}
            className="p-1 text-red-600 hover:bg-red-50 rounded"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const handleRowClick = (user: User) => {
    console.log('Row clicked:', user);
  };

  const handleExport = (data: User[], selectedOnly: boolean) => {
    console.log(`Exporting ${data.length} users (${selectedOnly ? 'selected only' : 'all'})`);
    // Custom export logic here
  };

  const simulateLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">BaseDataTable Example</h1>

      {/* Example Controls */}
      <div className="mb-4 flex gap-4">
        <Button onClick={simulateLoading}>Simulate Loading</Button>
        <Button variant="outline">
          Selected: {selectedUsers.length} users
        </Button>
      </div>

      {/* Basic Example */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Full Featured Table</h2>
        <BaseDataTable
          data={users}
          columns={columns}
          loading={loading}
          getRowKey={(user) => user.id}
          // Pagination
          pageSize={10}
          pageSizeOptions={[5, 10, 25, 50]}
          // Selection
          selectable
          multiSelect
          selectedRows={selectedUsers}
          onSelectionChange={setSelectedUsers}
          // Sorting
          defaultSort={[{ key: 'id', direction: 'asc' }]}
          multiSort
          // Search
          searchable
          globalFilter={globalFilter}
          onGlobalFilterChange={setGlobalFilter}
          // Styling
          striped
          hoverable
          stickyHeader
          maxHeight="600px"
          // Actions
          onRowClick={handleRowClick}
          rowClassName={(user) => user.status === 'inactive' ? 'opacity-50' : ''}
          // Export
          exportable
          exportFilename="users"
          onExport={handleExport}
          // Empty state
          emptyMessage="No users found"
        />
      </div>

      {/* Minimal Example */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Minimal Table</h2>
        <BaseDataTable
          data={users.slice(0, 5)}
          columns={columns.slice(0, 4)}
          getRowKey={(user) => user.id}
          selectable={false}
          searchable={false}
          exportable={false}
          compact
        />
      </div>

      {/* Error State Example */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Error State</h2>
        <BaseDataTable
          data={[]}
          columns={columns}
          getRowKey={(user) => user.id}
          error="Failed to fetch users. Please try again later."
        />
      </div>

      {/* Empty State Example */}
      <div className="mb-12">
        <h2 className="text-xl font-semibold mb-4">Empty State</h2>
        <BaseDataTable
          data={[]}
          columns={columns}
          getRowKey={(user) => user.id}
          emptyMessage="No users found. Create your first user to get started."
          emptyIcon={<User className="w-12 h-12 mb-4" />}
        />
      </div>
    </div>
  );
}