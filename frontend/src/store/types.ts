import { StateCreator } from 'zustand'

// Common types for all stores
export interface BaseStore {
  loading: boolean
  error: string | null
  clearError: () => void
}

// Slice type for combining stores
export type StateSlice<T> = StateCreator<T, [], [], T>

// API Response types
export interface ApiResponse<T> {
  data: T
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// Common entity types
export interface Timestamps {
  createdAt: string
  updatedAt: string
}

export interface WithId {
  id: string | number
}