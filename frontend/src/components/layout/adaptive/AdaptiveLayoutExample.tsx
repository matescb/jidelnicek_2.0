import React, { useState } from 'react';
import {
  AdaptiveContainer,
  AdaptiveSection,
  AdaptiveGrid,
  AdaptiveColumns,
  AdaptiveTwoColumn,
  AdaptiveSidebar,
  AdaptiveNavSidebar,
  AdaptiveDialog,
  AdaptiveTable,
  AdaptiveForm,
  AdaptiveFormField,
  AdaptiveFormSection,
  AdaptiveFormActions,
  AdaptiveHero,
  AdaptiveFeatureHero,
  AdaptiveCTAHero,
} from './index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Home, Users, Settings, FileText, BarChart } from 'lucide-react';

// Example data for table
const tableData = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin', status: 'Active' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User', status: 'Active' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'User', status: 'Inactive' },
];

const tableColumns = [
  { key: 'name', header: 'Name', priority: 'high' as const },
  { key: 'email', header: 'Email', priority: 'medium' as const },
  { key: 'role', header: 'Role', priority: 'medium' as const },
  { key: 'status', header: 'Status', priority: 'low' as const },
];

// Navigation items for sidebar
const navItems = [
  { label: 'Dashboard', icon: <Home className="h-4 w-4" />, active: true },
  { label: 'Users', icon: <Users className="h-4 w-4" /> },
  { label: 'Documents', icon: <FileText className="h-4 w-4" /> },
  { label: 'Analytics', icon: <BarChart className="h-4 w-4" /> },
  { label: 'Settings', icon: <Settings className="h-4 w-4" /> },
];

// Features for hero section
const features = [
  {
    icon: <Home className="h-6 w-6" />,
    title: 'Responsive Design',
    description: 'Seamlessly adapts to any screen size',
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: 'User Friendly',
    description: 'Intuitive interface for all users',
  },
  {
    icon: <Settings className="h-6 w-6" />,
    title: 'Customizable',
    description: 'Flexible components for any need',
  },
];

export function AdaptiveLayoutExample() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <AdaptiveHero
        title="Adaptive Layout Components"
        subtitle="Modern UI Components"
        description="Build responsive interfaces that seamlessly adapt between mobile and desktop layouts."
        size="lg"
        variant="centered"
        actions={
          <>
            <Button size="lg">Get Started</Button>
            <Button size="lg" variant="outline">Learn More</Button>
          </>
        }
      />

      {/* Feature Hero */}
      <AdaptiveFeatureHero
        title="Why Choose Adaptive Components?"
        description="Our components automatically adjust to provide the best user experience on any device."
        features={features}
        size="sm"
        variant="centered"
      />

      {/* Main Layout with Sidebar */}
      <AdaptiveSidebar
        sidebar={<AdaptiveNavSidebar items={navItems} />}
        sidebarClassName="bg-muted/50"
        breakpoint="lg"
      >
        <AdaptiveSection maxWidth="xl" spacing="lg">
          {/* Two Column Layout Example */}
          <h2 className="text-2xl font-bold mb-6">Two Column Layout</h2>
          <AdaptiveTwoColumn
            left={
              <div className="p-6 bg-muted rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Left Column</h3>
                <p className="text-muted-foreground">
                  This column can be made sticky, narrow, or wide depending on your needs.
                </p>
              </div>
            }
            right={
              <div className="p-6 bg-muted rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Right Column</h3>
                <p className="text-muted-foreground">
                  Content automatically stacks on mobile devices for better readability.
                </p>
              </div>
            }
            leftWidth="narrow"
            gap="lg"
          />

          {/* Adaptive Columns Example */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Adaptive Columns</h2>
            <AdaptiveColumns columns={3} gap="md">
              <div className="p-6 bg-primary/10 rounded-lg">
                <h3 className="font-semibold">Column 1</h3>
                <p className="text-sm mt-2">Flexible column content</p>
              </div>
              <div className="p-6 bg-primary/10 rounded-lg">
                <h3 className="font-semibold">Column 2</h3>
                <p className="text-sm mt-2">Automatically adjusts width</p>
              </div>
              <div className="p-6 bg-primary/10 rounded-lg">
                <h3 className="font-semibold">Column 3</h3>
                <p className="text-sm mt-2">Stacks on mobile devices</p>
              </div>
            </AdaptiveColumns>
          </div>

          {/* Grid Example */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Responsive Grid</h2>
            <AdaptiveGrid columns={{ mobile: 1, tablet: 2, desktop: 3 }} gap="md">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="p-6 bg-muted rounded-lg">
                  <h3 className="font-semibold">Grid Item {item}</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Responsive grid item that adapts to screen size
                  </p>
                </div>
              ))}
            </AdaptiveGrid>
          </div>

          {/* Table Example */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Adaptive Table</h2>
            <AdaptiveTable
              data={tableData}
              columns={tableColumns}
              mobileVariant="cards"
              onRowClick={(item) => console.log('Clicked:', item)}
            />
          </div>

          {/* Form Example */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Adaptive Form</h2>
            <AdaptiveForm onSubmit={handleSubmit} columns={2} gap="md">
              <AdaptiveFormSection title="Personal Information" columns={2}>
                <AdaptiveFormField label="First Name" required>
                  <Input
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  />
                </AdaptiveFormField>
                <AdaptiveFormField label="Last Name" required>
                  <Input
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  />
                </AdaptiveFormField>
                <AdaptiveFormField label="Email" span="full" required>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </AdaptiveFormField>
                <AdaptiveFormField label="Phone" span="full">
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </AdaptiveFormField>
              </AdaptiveFormSection>
              <AdaptiveFormActions>
                <Button type="button" variant="outline">Cancel</Button>
                <Button type="submit">Submit</Button>
              </AdaptiveFormActions>
            </AdaptiveForm>
          </div>

          {/* Dialog Example */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Adaptive Dialog</h2>
            <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
            <AdaptiveDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title="Adaptive Dialog"
              description="This dialog becomes a drawer on mobile devices"
              footer={
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setDialogOpen(false)}>
                    Confirm
                  </Button>
                </div>
              }
            >
              <p className="py-4">
                Dialog content automatically adapts to mobile and desktop layouts.
                On mobile, it appears as a bottom drawer for better accessibility.
              </p>
            </AdaptiveDialog>
          </div>

          {/* CTA Section */}
          <div className="mt-12">
            <AdaptiveCTAHero
              title="Ready to Get Started?"
              description="Start building responsive interfaces with our adaptive components today."
              primaryAction={{
                label: 'Start Building',
                onClick: () => console.log('Start building'),
              }}
              secondaryAction={{
                label: 'View Documentation',
                onClick: () => console.log('View docs'),
              }}
              variant="gradient"
            />
          </div>
        </AdaptiveSection>
      </AdaptiveSidebar>
    </div>
  );
}