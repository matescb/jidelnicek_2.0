import React, { useState } from 'react'
import { Edit, Trash2, Heart, Share2 } from 'lucide-react'
import { 
  DataTable, 
  VirtualizedList, 
  CollapsibleSection, 
  SwipeableListItem,
  Pagination,
  SortSelector
} from '@/components/ui'
import { TouchableArea } from '@/components/ui/TouchableArea'
import { Container } from '@/components/layout/Container'

interface DemoItem {
  id: number
  name: string
  description: string
  category: string
  rating: number
  price: number
}

const generateDemoData = (count: number): DemoItem[] => {
  const categories = ['Electronics', 'Books', 'Clothing', 'Food', 'Games']
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    description: `This is a description for item ${i + 1}. It contains some details about the item.`,
    category: categories[i % categories.length],
    rating: Math.floor(Math.random() * 5) + 1,
    price: Math.floor(Math.random() * 10000) / 100
  }))
}

export function ResponsiveListDemo() {
  const [data] = useState(() => generateDemoData(100))
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedView, setSelectedView] = useState<'table' | 'virtual' | 'collapsible' | 'swipeable'>('table')
  
  const itemsPerPage = 10
  const totalPages = Math.ceil(data.length / itemsPerPage)
  
  // Sort data
  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortBy as keyof DemoItem]
    const bValue = b[sortBy as keyof DemoItem]
    
    if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
    if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
    return 0
  })
  
  // Paginate data
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  
  const sortOptions = [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price' },
    { key: 'rating', label: 'Rating' }
  ]
  
  const tableColumns = [
    {
      key: 'name',
      header: 'Name',
      accessor: (item: DemoItem) => <span className="font-medium">{item.name}</span>,
      sortable: true
    },
    {
      key: 'category',
      header: 'Category',
      accessor: (item: DemoItem) => (
        <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
          {item.category}
        </span>
      ),
      sortable: true,
      mobileHidden: true
    },
    {
      key: 'price',
      header: 'Price',
      accessor: (item: DemoItem) => `$${item.price.toFixed(2)}`,
      sortable: true
    },
    {
      key: 'rating',
      header: 'Rating',
      accessor: (item: DemoItem) => (
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => (
            <span
              key={i}
              className={i < item.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
            >
              ★
            </span>
          ))}
        </div>
      ),
      sortable: true,
      mobileHidden: true
    }
  ]
  
  const swipeActions = {
    left: [
      {
        label: 'Favorite',
        icon: <Heart className="w-5 h-5" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        onClick: () => console.log('Favorite clicked')
      }
    ],
    right: [
      {
        label: 'Share',
        icon: <Share2 className="w-5 h-5" />,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        onClick: () => console.log('Share clicked')
      },
      {
        label: 'Delete',
        icon: <Trash2 className="w-5 h-5" />,
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        onClick: () => console.log('Delete clicked')
      }
    ]
  }
  
  return (
    <Container>
      <div className="py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Responsive List Components Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Examples of responsive list views with sorting, pagination, and mobile optimizations
          </p>
        </div>
        
        {/* View Selector */}
        <div className="flex flex-wrap gap-2">
          {(['table', 'virtual', 'collapsible', 'swipeable'] as const).map((view) => (
            <TouchableArea
              key={view}
              onClick={() => setSelectedView(view)}
              className={`
                px-4 py-2 rounded-lg capitalize
                ${selectedView === view
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
            >
              {view} View
            </TouchableArea>
          ))}
        </div>
        
        {/* Sort Controls */}
        <div className="flex items-center justify-between">
          <SortSelector
            options={sortOptions}
            value={sortBy}
            order={sortOrder}
            onChange={(key, order) => {
              setSortBy(key)
              setSortOrder(order)
              setCurrentPage(1)
            }}
            label="Sort by"
          />
        </div>
        
        {/* Views */}
        {selectedView === 'table' && (
          <div className="space-y-4">
            <DataTable
              columns={tableColumns}
              data={paginatedData}
              keyExtractor={(item) => item.id}
              onSort={(key, order) => {
                setSortBy(key)
                setSortOrder(order)
              }}
              onRowClick={(item) => console.log('Row clicked:', item)}
              actions={(item) => (
                <div className="flex items-center gap-2">
                  <TouchableArea className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </TouchableArea>
                  <TouchableArea className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </TouchableArea>
                </div>
              )}
              mobileRenderItem={(item) => (
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {item.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {item.category} • ${item.price.toFixed(2)}
                  </div>
                </div>
              )}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm"
            />
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
        
        {selectedView === 'virtual' && (
          <VirtualizedList
            items={sortedData}
            itemHeight={80}
            renderItem={(item) => (
              <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100">
                      {item.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.category} • ${item.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <span
                        key={i}
                        className={i < item.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
            className="h-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-sm"
          />
        )}
        
        {selectedView === 'collapsible' && (
          <div className="space-y-2">
            {paginatedData.map((item) => (
              <CollapsibleSection
                key={item.id}
                title={
                  <div className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      ${item.price.toFixed(2)}
                    </span>
                  </div>
                }
                badge={
                  <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded-full">
                    {item.category}
                  </span>
                }
              >
                <div className="space-y-2">
                  <p className="text-gray-600 dark:text-gray-400">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={i < item.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <TouchableArea className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                        Edit
                      </TouchableArea>
                      <TouchableArea className="px-3 py-1 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">
                        Delete
                      </TouchableArea>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            ))}
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              className="mt-4"
            />
          </div>
        )}
        
        {selectedView === 'swipeable' && (
          <div className="space-y-2">
            {paginatedData.map((item) => (
              <SwipeableListItem
                key={item.id}
                leftActions={swipeActions.left}
                rightActions={swipeActions.right}
                className="rounded-lg shadow-sm overflow-hidden"
              >
                <div className="p-4 bg-white dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100">
                        {item.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.category} • ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <span
                          key={i}
                          className={i < item.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                        >
                          ★
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </SwipeableListItem>
            ))}
            
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              className="mt-4"
            />
          </div>
        )}
      </div>
    </Container>
  )
}