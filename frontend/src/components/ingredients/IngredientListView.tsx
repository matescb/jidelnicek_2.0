import React, { useEffect, useState, useMemo, useCallback } from 'react'
import { Plus, Upload, Download, Filter, Beaker, DollarSign, Utensils, AlertTriangle, Merge, Edit2, Eye, Trash2 } from 'lucide-react'
import { BaseDataTable, Column } from '@/components/common/BaseDataTable'
import { useIngredientStore, IngredientWithDetails } from '@/store/slices/ingredientStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { useToastStore } from '@/store/slices/toastStore'

interface GroupedIngredient {
  category: string
  ingredients: IngredientWithDetails[]
}

export const IngredientListView: React.FC = () => {
  const { addToast } = useToastStore()
  
  const {
    ingredients,
    loading,
    error,
    filters,
    sortBy,
    sortOrder,
    categories,
    allergens,
    dietaryTags,
    potentialDuplicates,
    fetchIngredients,
    fetchCategories,
    fetchAllergens,
    fetchDietaryTags,
    setFilters,
    setSorting,
    clearFilters,
    deleteIngredient,
    mergeIngredients,
    exportIngredients,
    importIngredients,
    findDuplicates
  } = useIngredientStore()

  const [showFilters, setShowFilters] = useState(false)
  const [selectedIngredients, setSelectedIngredients] = useState<IngredientWithDetails[]>([])
  const [groupByCategory, setGroupByCategory] = useState(true)
  const [importFile, setImportFile] = useState<File | null>(null)

  // Load initial data
  useEffect(() => {
    fetchIngredients()
    fetchCategories()
    fetchAllergens()
    fetchDietaryTags()
  }, [])

  // Group ingredients by category if enabled
  const groupedData = useMemo(() => {
    if (!groupByCategory) return ingredients

    const grouped: Record<string, IngredientWithDetails[]> = {}
    ingredients.forEach(ingredient => {
      const category = ingredient.category || 'Uncategorized'
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(ingredient)
    })

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => ({
        category,
        ingredients: items
      }))
  }, [ingredients, groupByCategory])

  // Define table columns
  const columns: Column<IngredientWithDetails>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      filterable: true,
      render: (value, item) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{value}</span>
          {potentialDuplicates.has(item.id) && (
            <Badge variant="warning" size="sm">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Duplicate
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      filterable: true,
      render: (value) => (
        <Badge variant="secondary">{value || 'Uncategorized'}</Badge>
      )
    },
    {
      key: 'defaultUnit',
      header: 'Unit',
      render: (value) => <span className="text-sm text-gray-600">{value}</span>
    },
    {
      key: 'nutrition',
      header: 'Nutrition (per 100g)',
      render: (value: any) => (
        <div className="text-sm">
          <div className="flex items-center gap-4">
            <span>Cal: {value?.calories || 0}</span>
            <span>P: {value?.protein || 0}g</span>
            <span>C: {value?.carbs || 0}g</span>
            <span>F: {value?.fat || 0}g</span>
          </div>
        </div>
      )
    },
    {
      key: 'usageCount',
      header: 'Usage',
      sortable: true,
      render: (value) => (
        <div className="flex items-center gap-1">
          <Utensils className="w-4 h-4 text-gray-400" />
          <span>{value || 0}</span>
        </div>
      )
    },
    {
      key: 'price',
      header: 'Price',
      render: (value, item) => (
        value ? (
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <span>{value} {item.priceUnit || ''}</span>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )
      )
    },
    {
      key: 'allergens',
      header: 'Allergens',
      render: (value: string[]) => (
        value?.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {value.map(allergen => (
              <Badge key={allergen} variant="danger" size="sm">
                {allergen}
              </Badge>
            ))}
          </div>
        ) : null
      )
    },
    {
      key: 'dietaryTags',
      header: 'Dietary',
      render: (value: string[]) => (
        value?.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {value.map(tag => (
              <Badge key={tag} variant="success" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_, item) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleViewDetails(item)}
            title="View details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleEdit(item)}
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          {potentialDuplicates.has(item.id) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleMergeDuplicate(item)}
              title="Merge duplicate"
            >
              <Merge className="w-4 h-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDelete(item)}
            title="Delete"
            className="text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ]

  // Handlers
  const handleViewDetails = (ingredient: IngredientWithDetails) => {
    // Navigate to ingredient details page
    window.location.href = `/ingredients/${ingredient.id}`
  }

  const handleEdit = (ingredient: IngredientWithDetails) => {
    // Navigate to edit page or open modal
    window.location.href = `/ingredients/${ingredient.id}/edit`
  }

  const handleDelete = async (ingredient: IngredientWithDetails) => {
    if (confirm(`Are you sure you want to delete "${ingredient.name}"?`)) {
      try {
        await deleteIngredient(ingredient.id)
        addToast({
          variant: 'success',
          title: `Ingredient "${ingredient.name}" deleted successfully`
        })
      } catch (error) {
        addToast({
          variant: 'error',
          title: 'Failed to delete ingredient'
        })
      }
    }
  }

  const handleMergeDuplicate = async (ingredient: IngredientWithDetails) => {
    const duplicateIds = potentialDuplicates.get(ingredient.id)
    if (!duplicateIds?.length) return

    // Show merge dialog (simplified version)
    const targetId = prompt(`Select target ingredient ID to merge into (${duplicateIds.join(', ')})`)
    if (targetId && duplicateIds.includes(targetId)) {
      try {
        await mergeIngredients(ingredient.id, targetId)
        addToast({
          variant: 'success',
          title: 'Ingredients merged successfully'
        })
      } catch (error) {
        addToast({
          variant: 'error',
          title: 'Failed to merge ingredients'
        })
      }
    }
  }

  const handleImport = async () => {
    if (!importFile) return

    try {
      const result = await importIngredients(importFile)
      addToast({
        variant: 'success',
        title: `Imported ${result.imported} ingredients successfully`
      })
      if (result.errors.length > 0) {
        addToast({
          variant: 'warning',
          title: `${result.errors.length} ingredients failed to import`
        })
      }
      setImportFile(null)
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Failed to import ingredients'
      })
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      await exportIngredients(format, true)
      addToast({
        variant: 'success',
        title: `Exported ingredients as ${format.toUpperCase()}`
      })
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Failed to export ingredients'
      })
    }
  }

  const handleFindDuplicates = async () => {
    try {
      await findDuplicates()
      const duplicateCount = potentialDuplicates.size
      if (duplicateCount > 0) {
        addToast({
          variant: 'info',
          title: `Found ${duplicateCount} potential duplicates`
        })
      } else {
        addToast({
          variant: 'success',
          title: 'No duplicates found'
        })
      }
    } catch (error) {
      addToast({
        variant: 'error',
        title: 'Failed to find duplicates'
      })
    }
  }

  // Filter change handlers
  const handleSearchChange = useCallback((value: string) => {
    setFilters({ search: value })
  }, [setFilters])

  const handleCategoryFilter = useCallback((value: string[]) => {
    setFilters({ category: value.length > 0 ? value : undefined })
  }, [setFilters])

  const handleAllergenFilter = useCallback((value: string[]) => {
    setFilters({ allergens: value.length > 0 ? value : undefined })
  }, [setFilters])

  const handleDietaryFilter = useCallback((value: string[]) => {
    setFilters({ dietaryTags: value.length > 0 ? value : undefined })
  }, [setFilters])

  // Render grouped view
  if (groupByCategory && !loading && !error) {
    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Ingredients</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupByCategory(false)}
            >
              Ungrouped View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFindDuplicates}
            >
              <Merge className="w-4 h-4 mr-2" />
              Find Duplicates
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.location.href = '/ingredients/new'}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Ingredient
            </Button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input
                placeholder="Search ingredients..."
                value={filters.search || ''}
                onChange={(e) => handleSearchChange(e.target.value)}
                icon={<Search className="w-4 h-4" />}
              />
              <MultiSelect
                options={categories.map(c => ({ value: c, label: c }))}
                value={filters.category || []}
                onChange={handleCategoryFilter}
                placeholder="Categories"
              />
              <MultiSelect
                options={allergens.map(a => ({ value: a, label: a }))}
                value={filters.allergens || []}
                onChange={handleAllergenFilter}
                placeholder="Allergens"
              />
              <MultiSelect
                options={dietaryTags.map(d => ({ value: d, label: d }))}
                value={filters.dietaryTags || []}
                onChange={handleDietaryFilter}
                placeholder="Dietary Tags"
              />
            </div>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}

        {/* Import/Export Bar */}
        <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".csv,.json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="hidden"
              id="import-file"
            />
            <label htmlFor="import-file">
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer"
                asChild
              >
                <span>
                  <Upload className="w-4 h-4 mr-2" />
                  Import
                </span>
              </Button>
            </label>
            {importFile && (
              <>
                <span className="text-sm text-gray-600">{importFile.name}</span>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleImport}
                >
                  Upload
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('csv')}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('json')}
            >
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Grouped Ingredients */}
        <div className="space-y-6">
          {(groupedData as GroupedIngredient[]).map(group => (
            <div key={group.category} className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {group.category}
                <Badge variant="secondary" size="sm">
                  {group.ingredients.length}
                </Badge>
              </h2>
              <BaseDataTable
                data={group.ingredients}
                columns={columns}
                getRowKey={(item) => item.id}
                selectable
                multiSelect
                selectedRows={selectedIngredients}
                onSelectionChange={setSelectedIngredients}
                striped
                compact
                stickyHeader={false}
                searchable={false}
                exportable={false}
                pageSize={50}
                pageSizeOptions={[50, 100, 200]}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render ungrouped view
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ingredients</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setGroupByCategory(true)}
          >
            Group by Category
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFindDuplicates}
          >
            <Merge className="w-4 h-4 mr-2" />
            Find Duplicates
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => window.location.href = '/ingredients/new'}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Ingredient
          </Button>
        </div>
      </div>

      {/* Main Table */}
      <BaseDataTable
        data={ingredients}
        columns={columns}
        loading={loading}
        error={error}
        getRowKey={(item) => item.id}
        selectable
        multiSelect
        selectedRows={selectedIngredients}
        onSelectionChange={setSelectedIngredients}
        searchable
        searchPlaceholder="Search ingredients..."
        globalFilter={filters.search}
        onGlobalFilterChange={handleSearchChange}
        defaultSort={[{ key: sortBy, direction: sortOrder }]}
        onRowClick={handleViewDetails}
        exportable
        exportFilename="ingredients"
        pageSize={50}
        pageSizeOptions={[20, 50, 100, 200]}
      />

      {/* Import/Export Section */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv,.json"
            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            className="hidden"
            id="import-file-ungrouped"
          />
          <label htmlFor="import-file-ungrouped">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              asChild
            >
              <span>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </span>
            </Button>
          </label>
          {importFile && (
            <>
              <span className="text-sm text-gray-600">{importFile.name}</span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleImport}
              >
                Upload
              </Button>
            </>
          )}
        </div>
        <div className="text-sm text-gray-600">
          Total ingredients: {ingredients.length}
        </div>
      </div>
    </div>
  )
}