/**
 * Slice Factory
 * Factory functions for creating common store slice patterns
 */

import type {
  SliceConfig,
  CrudSliceConfig,
  AsyncSliceConfig,
  ListSliceConfig,
  FormSliceConfig,
  ModalSliceConfig,
  CrudOperations,
  AsyncState,
  ListState,
  FormState,
  ModalState,
} from './types';

/**
 * Create a CRUD slice with standard operations
 */
export function createCrudSlice<T extends { id?: any }, Id = string | number>(
  config: CrudSliceConfig<T, Id>
): SliceConfig<CrudOperations<T, Id>> {
  const {
    name,
    initialItems = [],
    idField = 'id' as keyof T,
    sortField,
    sortOrder = 'asc',
  } = config;

  return {
    name,
    create: (set, get) => {
      // Helper to sort items
      const sortItems = (items: T[]): T[] => {
        if (!sortField) return items;
        
        return [...items].sort((a, b) => {
          const aVal = a[sortField];
          const bVal = b[sortField];
          
          if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
      };

      return {
        items: sortItems(initialItems),
        selectedId: null,
        loading: false,
        error: null,

        // Actions
        add: (item: T) =>
          set((state) => ({
            items: sortItems([...state.items, item]),
            error: null,
          })),

        update: (id: Id, updates: Partial<T>) =>
          set((state) => ({
            items: sortItems(
              state.items.map((item) =>
                item[idField] === id ? { ...item, ...updates } : item
              )
            ),
            error: null,
          })),

        remove: (id: Id) =>
          set((state) => ({
            items: state.items.filter((item) => item[idField] !== id),
            selectedId: state.selectedId === id ? null : state.selectedId,
            error: null,
          })),

        select: (id: Id | null) =>
          set({ selectedId: id }),

        setItems: (items: T[]) =>
          set({ items: sortItems(items), error: null }),

        clear: () =>
          set({ items: [], selectedId: null, error: null }),

        // Computed
        get selectedItem() {
          const state = get();
          return state.items.find((item: T) => item[idField] === state.selectedId);
        },

        get count() {
          return get().items.length;
        },
      };
    },
  };
}

/**
 * Create an async slice with loading states
 */
export function createAsyncSlice<T>(
  config: AsyncSliceConfig<T>
): SliceConfig<AsyncState<T>> {
  const {
    name,
    initialData = null,
    fetchFn,
    updateFn,
    errorHandler,
  } = config;

  return {
    name,
    create: (set, get) => ({
      data: initialData,
      loading: false,
      error: null,
      lastFetch: null,

      // Actions
      fetch: async () => {
        set({ loading: true, error: null });
        
        try {
          const data = await fetchFn();
          set({
            data,
            loading: false,
            lastFetch: new Date(),
          });
        } catch (error) {
          const err = error as Error;
          set({ loading: false, error: err });
          
          if (errorHandler) {
            errorHandler(err);
          }
        }
      },

      update: async (data: T) => {
        if (!updateFn) {
          set({ data });
          return;
        }

        set({ loading: true, error: null });
        
        try {
          const updatedData = await updateFn(data);
          set({
            data: updatedData,
            loading: false,
          });
        } catch (error) {
          const err = error as Error;
          set({ loading: false, error: err });
          
          if (errorHandler) {
            errorHandler(err);
          }
        }
      },

      reset: () =>
        set({
          data: initialData,
          loading: false,
          error: null,
          lastFetch: null,
        }),

      setLoading: (loading: boolean) => set({ loading }),
      
      setError: (error: Error | null) => set({ error }),
    }),
  };
}

/**
 * Create a list slice with pagination and filtering
 */
export function createListSlice<T>(
  config: ListSliceConfig<T>
): SliceConfig<ListState<T>> {
  const {
    name,
    initialItems = [],
    pageSize = 10,
    sortable = true,
    filterable = true,
    searchable = true,
  } = config;

  return {
    name,
    create: (set, get) => {
      // Helper to apply filters
      const applyFilters = (items: T[]): T[] => {
        let filtered = [...items];
        const state = get();

        // Apply search
        if (searchable && state.searchQuery) {
          filtered = filtered.filter((item) => {
            const searchStr = JSON.stringify(item).toLowerCase();
            return searchStr.includes(state.searchQuery.toLowerCase());
          });
        }

        // Apply filters
        if (filterable && Object.keys(state.filters).length > 0) {
          filtered = filtered.filter((item) => {
            return Object.entries(state.filters).every(([key, value]) => {
              if (value === undefined || value === null) return true;
              return (item as any)[key] === value;
            });
          });
        }

        // Apply sorting
        if (sortable && state.sortBy) {
          filtered.sort((a, b) => {
            const aVal = (a as any)[state.sortBy!];
            const bVal = (b as any)[state.sortBy!];
            
            if (aVal < bVal) return state.sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return state.sortOrder === 'asc' ? 1 : -1;
            return 0;
          });
        }

        return filtered;
      };

      // Helper to calculate pagination
      const paginate = (items: T[]): T[] => {
        const state = get();
        const start = (state.page - 1) * state.pageSize;
        const end = start + state.pageSize;
        return items.slice(start, end);
      };

      return {
        items: initialItems,
        page: 1,
        pageSize,
        totalItems: initialItems.length,
        totalPages: Math.ceil(initialItems.length / pageSize),
        sortBy: null,
        sortOrder: 'asc',
        filters: {},
        searchQuery: '',
        loading: false,

        // Actions
        setPage: (page: number) => set({ page }),

        setPageSize: (size: number) =>
          set((state) => ({
            pageSize: size,
            totalPages: Math.ceil(state.totalItems / size),
            page: 1,
          })),

        setSort: (field: keyof T, order = 'asc' as 'asc' | 'desc') =>
          set({ sortBy: field, sortOrder: order }),

        setFilter: (key: string, value: any) =>
          set((state) => ({
            filters: { ...state.filters, [key]: value },
            page: 1,
          })),

        clearFilters: () => set({ filters: {}, page: 1 }),

        setSearchQuery: (query: string) =>
          set({ searchQuery: query, page: 1 }),

        refresh: async () => {
          // This would typically fetch fresh data
          // For now, just recalculate pagination
          set((state) => {
            const filtered = applyFilters(state.items);
            return {
              totalItems: filtered.length,
              totalPages: Math.ceil(filtered.length / state.pageSize),
            };
          });
        },
      };
    },
  };
}

/**
 * Create a form slice with validation
 */
export function createFormSlice<T extends Record<string, any>>(
  config: FormSliceConfig<T>
): SliceConfig<FormState<T>> {
  const {
    name,
    initialValues,
    validationSchema,
    onSubmit,
    resetOnSubmit = true,
  } = config;

  return {
    name,
    create: (set, get) => {
      // Validation helper
      const validateField = (field: keyof T, value: any): string | undefined => {
        if (!validationSchema) return undefined;
        
        try {
          // This is a simplified validation - real implementation would use the schema
          return undefined;
        } catch (error) {
          return (error as Error).message;
        }
      };

      const validateForm = (): boolean => {
        if (!validationSchema) return true;
        
        const state = get();
        const errors: Partial<Record<keyof T, string>> = {};
        let isValid = true;

        for (const field of Object.keys(state.values)) {
          const error = validateField(field as keyof T, state.values[field]);
          if (error) {
            errors[field as keyof T] = error;
            isValid = false;
          }
        }

        set({ errors, isValid });
        return isValid;
      };

      return {
        values: { ...initialValues },
        errors: {},
        touched: {},
        isSubmitting: false,
        isValid: true,
        isDirty: false,

        // Actions
        setFieldValue: (field, value) =>
          set((state) => {
            const error = validateField(field, value);
            return {
              values: { ...state.values, [field]: value },
              errors: { ...state.errors, [field]: error },
              isDirty: true,
            };
          }),

        setFieldError: (field, error) =>
          set((state) => ({
            errors: { ...state.errors, [field]: error },
            isValid: false,
          })),

        setFieldTouched: (field, touched = true) =>
          set((state) => ({
            touched: { ...state.touched, [field]: touched },
          })),

        setValues: (values) =>
          set((state) => ({
            values: { ...state.values, ...values },
            isDirty: true,
          })),

        setErrors: (errors) =>
          set((state) => ({
            errors: { ...state.errors, ...errors },
            isValid: Object.keys(errors).length === 0,
          })),

        submit: async () => {
          const state = get();
          
          if (!validateForm()) {
            return;
          }

          set({ isSubmitting: true });

          try {
            await onSubmit(state.values);
            
            if (resetOnSubmit) {
              set({
                values: { ...initialValues },
                errors: {},
                touched: {},
                isSubmitting: false,
                isDirty: false,
              });
            } else {
              set({ isSubmitting: false });
            }
          } catch (error) {
            set({ isSubmitting: false });
            throw error;
          }
        },

        reset: () =>
          set({
            values: { ...initialValues },
            errors: {},
            touched: {},
            isSubmitting: false,
            isValid: true,
            isDirty: false,
          }),

        validate: validateForm,
      };
    },
  };
}

/**
 * Create a modal/dialog slice
 */
export function createModalSlice(
  config: ModalSliceConfig
): SliceConfig<ModalState> {
  const { name, modals } = config;

  // Initialize modal states
  const initialModals: Record<string, { isOpen: boolean; data?: any }> = {};
  for (const [modalId, modalConfig] of Object.entries(modals)) {
    initialModals[modalId] = {
      isOpen: modalConfig.defaultOpen || false,
      data: modalConfig.data,
    };
  }

  return {
    name,
    create: (set, get) => ({
      modals: initialModals,

      // Actions
      open: (modalId: string, data?: any) =>
        set((state) => ({
          modals: {
            ...state.modals,
            [modalId]: { isOpen: true, data: data || state.modals[modalId]?.data },
          },
        })),

      close: (modalId: string) =>
        set((state) => ({
          modals: {
            ...state.modals,
            [modalId]: { ...state.modals[modalId], isOpen: false },
          },
        })),

      toggle: (modalId: string) =>
        set((state) => ({
          modals: {
            ...state.modals,
            [modalId]: {
              ...state.modals[modalId],
              isOpen: !state.modals[modalId]?.isOpen,
            },
          },
        })),

      closeAll: () =>
        set((state) => {
          const closedModals: typeof state.modals = {};
          for (const [id, modal] of Object.entries(state.modals)) {
            closedModals[id] = { ...modal, isOpen: false };
          }
          return { modals: closedModals };
        }),

      isOpen: (modalId: string) => get().modals[modalId]?.isOpen || false,

      getData: (modalId: string) => get().modals[modalId]?.data,
    }),
  };
}

/**
 * Create a paginated async slice combining async and list features
 */
export function createPaginatedAsyncSlice<T>(
  config: AsyncSliceConfig<T[]> & ListSliceConfig<T>
): SliceConfig<AsyncState<T[]> & ListState<T>> {
  const asyncSlice = createAsyncSlice<T[]>({
    ...config,
    initialData: config.initialItems || [],
  });

  const listSlice = createListSlice<T>(config);

  return {
    name: config.name,
    create: (set, get, api) => {
      const async = asyncSlice.create(set, get, api);
      const list = listSlice.create(set, get, api);

      return {
        ...async,
        ...list,
        items: async.data || [],
        
        // Override fetch to update items
        fetch: async () => {
          await async.fetch();
          const data = get().data;
          if (data) {
            set({ items: data });
          }
        },
      };
    },
  };
}