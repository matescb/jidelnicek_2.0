import React from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import { 
  BreadcrumbProvider, 
  Breadcrumbs, 
  SimpleBreadcrumbs,
  useBreadcrumbTitle,
  useSetBreadcrumbs,
  useAppendBreadcrumb,
} from './index';
import { FiHome, FiBook, FiEdit, FiUser } from 'react-icons/fi';

// Example component that sets custom breadcrumb title
const RecipeDetail: React.FC = () => {
  const { id } = useParams();
  
  // Set dynamic breadcrumb title based on recipe data
  useBreadcrumbTitle(`Recipe #${id}`, [id]);
  
  return (
    <div>
      <h1>Recipe Detail Page</h1>
      <p>Recipe ID: {id}</p>
    </div>
  );
};

// Example component with custom breadcrumbs
const UserProfile: React.FC = () => {
  const setBreadcrumbs = useSetBreadcrumbs();
  
  React.useEffect(() => {
    // Set completely custom breadcrumbs
    const cleanup = setBreadcrumbs([
      { id: 'home', label: 'Dashboard', path: '/dashboard', icon: <FiHome className="h-4 w-4" /> },
      { id: 'users', label: 'Users', path: '/users' },
      { id: 'profile', label: 'John Doe', path: '/users/123', icon: <FiUser className="h-4 w-4" />, isActive: true },
    ]);
    
    return cleanup;
  }, [setBreadcrumbs]);
  
  return (
    <div>
      <h1>User Profile</h1>
      <p>Custom breadcrumbs example</p>
    </div>
  );
};

// Example component that appends a breadcrumb
const RecipeEdit: React.FC = () => {
  const { id } = useParams();
  
  // Append "Edit" to the breadcrumb trail
  useAppendBreadcrumb({
    label: 'Edit',
    path: `/recipes/${id}/edit`,
    icon: <FiEdit className="h-4 w-4" />,
  });
  
  return (
    <div>
      <h1>Edit Recipe</h1>
      <p>This page appends an "Edit" breadcrumb</p>
    </div>
  );
};

// Layout component that displays breadcrumbs
const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="container mx-auto px-4 py-4">
          <Breadcrumbs 
            className="mb-4"
            mobileMaxItems={2}
            desktopMaxItems={5}
            truncateMode="middle"
          />
        </div>
      </div>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

// Main example app
export const BreadcrumbsExample: React.FC = () => {
  return (
    <BrowserRouter>
      <BreadcrumbProvider autoGenerate={true}>
        <Layout>
          <Routes>
            <Route path="/" element={<div>Home Page</div>} />
            <Route path="/recipes" element={<div>Recipe List</div>} />
            <Route path="/recipes/:id" element={<RecipeDetail />} />
            <Route path="/recipes/:id/edit" element={<RecipeEdit />} />
            <Route path="/users/:id" element={<UserProfile />} />
          </Routes>
        </Layout>
      </BreadcrumbProvider>
    </BrowserRouter>
  );
};

// Standalone breadcrumbs example (without provider)
export const StandaloneBreadcrumbsExample: React.FC = () => {
  const items = [
    { label: 'Home', path: '/', icon: <FiHome className="h-4 w-4" /> },
    { label: 'Recipes', path: '/recipes', icon: <FiBook className="h-4 w-4" /> },
    { label: 'Chocolate Cake', path: '/recipes/123' },
    { label: 'Edit' },
  ];
  
  return (
    <div className="p-8 space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Simple Breadcrumbs</h3>
        <SimpleBreadcrumbs items={items} />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-4">With Custom Separator</h3>
        <SimpleBreadcrumbs 
          items={items} 
          separator={<span className="mx-2">/</span>} 
        />
      </div>
    </div>
  );
};

// Different breadcrumb configurations
export const BreadcrumbConfigurationsExample: React.FC = () => {
  return (
    <BreadcrumbProvider>
      <div className="space-y-8 p-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">Default Configuration</h3>
          <Breadcrumbs />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-4">Mobile View (2 items max)</h3>
          <Breadcrumbs mobileMaxItems={2} className="max-w-xs" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-4">End Truncation</h3>
          <Breadcrumbs truncateMode="end" maxItems={3} />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold mb-4">Custom Styling</h3>
          <Breadcrumbs
            className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg"
            linkClassName="text-blue-600 hover:text-blue-800"
            activeClassName="text-gray-900 font-bold"
            separatorClassName="text-blue-400"
          />
        </div>
      </div>
    </BreadcrumbProvider>
  );
};