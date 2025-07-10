import React from 'react';
import { TripWizardProvider } from './TripWizardContext';
import { useTripWizard } from './TripWizardContext';
import { WizardProgress } from './WizardProgress';
import { WizardNavigation } from './WizardNavigation';
import { TripBasicInfoStep } from './TripBasicInfoStep';
import { TripParticipantsStep } from './TripParticipantsStep';
import { TripMealSlotsStep } from './TripMealSlotsStep';
import { TripReviewStep } from './TripReviewStep';
import { Card, CardContent } from '../ui/card';
import { TripWizardData } from './TripWizardTypes';

interface TripWizardProps {
  initialData?: Partial<TripWizardData>;
  onComplete?: (data: TripWizardData) => void;
}

const WIZARD_STEPS = [
  {
    title: 'Basic Information',
    description: 'Trip details and dates',
    component: TripBasicInfoStep,
  },
  {
    title: 'Participants',
    description: 'Who\'s joining the trip',
    component: TripParticipantsStep,
  },
  {
    title: 'Meal Slots',
    description: 'Configure meal times',
    component: TripMealSlotsStep,
  },
  {
    title: 'Review',
    description: 'Review and confirm',
    component: TripReviewStep,
  },
];

const TripWizardContent: React.FC = () => {
  const { currentStep } = useTripWizard();
  const CurrentStepComponent = WIZARD_STEPS[currentStep].component;

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Progress Indicator */}
      <div className="mb-8">
        <WizardProgress currentStep={currentStep} steps={WIZARD_STEPS} />
      </div>

      {/* Wizard Content */}
      <Card className="shadow-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          {/* Step Header - Mobile Friendly */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {WIZARD_STEPS[currentStep].title}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {WIZARD_STEPS[currentStep].description}
            </p>
          </div>

          {/* Step Content */}
          <div className="min-h-[300px] transition-opacity duration-300">
            <CurrentStepComponent />
          </div>

          {/* Navigation */}
          <WizardNavigation
            isFirstStep={currentStep === 0}
            isLastStep={currentStep === WIZARD_STEPS.length - 1}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export const TripWizard: React.FC<TripWizardProps> = ({
  initialData,
  onComplete,
}) => {
  return (
    <TripWizardProvider initialData={initialData} onComplete={onComplete}>
      <TripWizardContent />
    </TripWizardProvider>
  );
};

export default TripWizard;