import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import axios from 'axios'
import type { BaseStore } from '../types'
import type { User } from './authStore'

// Extended user type with admin-specific fields
export interface AdminUser extends User {
  lastLogin?: string
  status: 'active' | 'inactive' | 'suspended'
  tripsCreated?: number
  recipesAdded?: number
  invitationToken?: string
  invitedBy?: string
  invitedAt?: string
}

// User filter options
export interface UserFilters {
  role?: 'admin' | 'user' | ''
  status?: 'active' | 'inactive' | 'suspended' | ''
  emailVerified?: boolean | null
  dateJoinedFrom?: string
  dateJoinedTo?: string
  search?: string
}

// User sort options
export interface UserSort {
  field: 'name' | 'email' | 'lastLogin' | 'createdAt'
  direction: 'asc' | 'desc'
}

// Bulk actions
export type BulkAction = 'activate' | 'deactivate' | 'changeRole' | 'delete' | 'export'

// Admin store interface
export interface AdminStore extends BaseStore {
  // State
  users: AdminUser[]
  totalUsers: number
  currentPage: number
  pageSize: number
  filters: UserFilters
  sort: UserSort
  selectedUsers: string[]
  
  // Actions
  fetchUsers: (page?: number) => Promise<void>
  fetchUserById: (userId: string) => Promise<AdminUser>
  updateUser: (userId: string, updates: Partial<AdminUser>) => Promise<void>
  suspendUser: (userId: string, reason?: string) => Promise<void>
  activateUser: (userId: string) => Promise<void>
  changeUserRole: (userId: string, role: 'admin' | 'user') => Promise<void>
  resetUserPassword: (userId: string) => Promise<{ temporaryPassword: string }>
  inviteUser: (email: string, role?: 'admin' | 'user') => Promise<void>
  resendInvitation: (userId: string) => Promise<void>
  deleteUser: (userId: string) => Promise<void>
  
  // Bulk actions
  performBulkAction: (action: BulkAction, userIds: string[], options?: any) => Promise<void>
  exportUsers: (userIds?: string[]) => Promise<void>
  
  // UI actions
  setFilters: (filters: UserFilters) => void
  setSort: (sort: UserSort) => void
  setSelectedUsers: (userIds: string[]) => void
  toggleUserSelection: (userId: string) => void
  selectAllUsers: (select: boolean) => void
  setPageSize: (size: number) => void
  setCurrentPage: (page: number) => void
  
  // User activity
  fetchUserActivity: (userId: string) => Promise<{
    trips: any[]
    recipes: any[]
    lastActions: any[]
  }>
}

export const useAdminStore = create<AdminStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      users: [],
      totalUsers: 0,
      currentPage: 1,
      pageSize: 25,
      filters: {
        role: '',
        status: '',
        emailVerified: null,
        search: ''
      },
      sort: {
        field: 'createdAt',
        direction: 'desc'
      },
      selectedUsers: [],
      loading: false,
      error: null,

      // Actions
      clearError: () => set((state) => {
        state.error = null
      }),

      fetchUsers: async (page) => {
        set((state) => {
          state.loading = true
          state.error = null
          if (page !== undefined) {
            state.currentPage = page
          }
        })

        try {
          const { filters, sort, pageSize, currentPage } = get()
          const params = new URLSearchParams({
            page: String(page ?? currentPage),
            limit: String(pageSize),
            sortBy: sort.field,
            sortOrder: sort.direction,
          })

          // Add filters
          if (filters.role) params.append('role', filters.role)
          if (filters.status) params.append('status', filters.status)
          if (filters.emailVerified !== null) params.append('emailVerified', String(filters.emailVerified))
          if (filters.dateJoinedFrom) params.append('dateJoinedFrom', filters.dateJoinedFrom)
          if (filters.dateJoinedTo) params.append('dateJoinedTo', filters.dateJoinedTo)
          if (filters.search) params.append('search', filters.search)

          const response = await axios.get(`/api/v1/admin/users?${params}`)
          const { users, total } = response.data

          set((state) => {
            state.users = users
            state.totalUsers = total
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to fetch users'
          })
          throw error
        }
      },

      fetchUserById: async (userId) => {
        try {
          const response = await axios.get(`/api/v1/admin/users/${userId}`)
          return response.data.user
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to fetch user')
        }
      },

      updateUser: async (userId, updates) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          const response = await axios.put(`/api/v1/admin/users/${userId}`, updates)
          const updatedUser = response.data.user

          set((state) => {
            state.users = state.users.map(user => 
              user.id === userId ? updatedUser : user
            )
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to update user'
          })
          throw error
        }
      },

      suspendUser: async (userId, reason) => {
        await get().updateUser(userId, { 
          status: 'suspended',
          suspensionReason: reason 
        })
      },

      activateUser: async (userId) => {
        await get().updateUser(userId, { status: 'active' })
      },

      changeUserRole: async (userId, role) => {
        await get().updateUser(userId, { role })
      },

      resetUserPassword: async (userId) => {
        try {
          const response = await axios.post(`/api/v1/admin/users/${userId}/reset-password`)
          return { temporaryPassword: response.data.temporaryPassword }
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to reset password')
        }
      },

      inviteUser: async (email, role = 'user') => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          await axios.post('/api/v1/admin/users/invite', { email, role })
          set((state) => {
            state.loading = false
          })
          // Refresh users list
          await get().fetchUsers()
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to send invitation'
          })
          throw error
        }
      },

      resendInvitation: async (userId) => {
        try {
          await axios.post(`/api/v1/admin/users/${userId}/resend-invitation`)
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to resend invitation')
        }
      },

      deleteUser: async (userId) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          await axios.delete(`/api/v1/admin/users/${userId}`)
          
          set((state) => {
            state.users = state.users.filter(user => user.id !== userId)
            state.selectedUsers = state.selectedUsers.filter(id => id !== userId)
            state.totalUsers = state.totalUsers - 1
            state.loading = false
          })
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Failed to delete user'
          })
          throw error
        }
      },

      performBulkAction: async (action, userIds, options) => {
        set((state) => {
          state.loading = true
          state.error = null
        })

        try {
          await axios.post('/api/v1/admin/users/bulk-action', {
            action,
            userIds,
            ...options
          })

          set((state) => {
            state.loading = false
            state.selectedUsers = []
          })

          // Refresh users list
          await get().fetchUsers()
        } catch (error: any) {
          set((state) => {
            state.loading = false
            state.error = error.response?.data?.message || 'Bulk action failed'
          })
          throw error
        }
      },

      exportUsers: async (userIds) => {
        try {
          const params = userIds?.length 
            ? `?userIds=${userIds.join(',')}`
            : ''
          
          const response = await axios.get(`/api/v1/admin/users/export${params}`, {
            responseType: 'blob'
          })
          
          // Create download link
          const url = window.URL.createObjectURL(new Blob([response.data]))
          const link = document.createElement('a')
          link.href = url
          link.setAttribute('download', `users-${new Date().toISOString().split('T')[0]}.csv`)
          document.body.appendChild(link)
          link.click()
          link.remove()
          window.URL.revokeObjectURL(url)
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Export failed')
        }
      },

      setFilters: (filters) => {
        set((state) => {
          state.filters = { ...state.filters, ...filters }
          state.currentPage = 1 // Reset to first page
        })
        // Fetch with new filters
        get().fetchUsers()
      },

      setSort: (sort) => {
        set((state) => {
          state.sort = sort
        })
        // Fetch with new sort
        get().fetchUsers()
      },

      setSelectedUsers: (userIds) => {
        set((state) => {
          state.selectedUsers = userIds
        })
      },

      toggleUserSelection: (userId) => {
        set((state) => {
          if (state.selectedUsers.includes(userId)) {
            state.selectedUsers = state.selectedUsers.filter(id => id !== userId)
          } else {
            state.selectedUsers.push(userId)
          }
        })
      },

      selectAllUsers: (select) => {
        set((state) => {
          if (select) {
            state.selectedUsers = state.users.map(user => user.id)
          } else {
            state.selectedUsers = []
          }
        })
      },

      setPageSize: (size) => {
        set((state) => {
          state.pageSize = size
          state.currentPage = 1
        })
        get().fetchUsers()
      },

      setCurrentPage: (page) => {
        set((state) => {
          state.currentPage = page
        })
        get().fetchUsers()
      },

      fetchUserActivity: async (userId) => {
        try {
          const response = await axios.get(`/api/v1/admin/users/${userId}/activity`)
          return response.data
        } catch (error: any) {
          throw new Error(error.response?.data?.message || 'Failed to fetch user activity')
        }
      }
    })),
    {
      name: 'AdminStore'
    }
  )
)