import React from 'react';
import { TripWizard } from './TripWizard';
import { TripWizardData } from './TripWizardTypes';

/**
 * Demo component showing how to use the TripWizard
 */
export const TripWizardDemo: React.FC = () => {
  const handleTripComplete = (data: TripWizardData) => {
    console.log('Trip created:', data);
    // Here you would typically:
    // 1. Send the data to your API
    // 2. Show a success message
    // 3. Redirect to the trip details page
  };

  // Optional: Pre-fill some data for editing an existing trip
  const initialData: Partial<TripWizardData> = {
    // basicInfo: {
    //   name: 'Summer Camping 2024',
    //   startDate: new Date('2024-07-01'),
    //   endDate: new Date('2024-07-05'),
    //   tripType: 'camping',
    // },
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-gray-100">
          Create New Trip
        </h1>
        
        <TripWizard 
          initialData={initialData}
          onComplete={handleTripComplete}
        />
      </div>
    </div>
  );
};

// Usage in your app:
// import { TripWizard } from './components/trips';
// 
// function CreateTripPage() {
//   return <TripWizard onComplete={(data) => console.log(data)} />;
// }