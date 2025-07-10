import React from 'react';
import { ArrowLeft, ArrowRight, Save, Send } from 'lucide-react';
import { Button } from '../ui/button';
import { useTripWizard } from './TripWizardContext';

interface WizardNavigationProps {
  isLastStep: boolean;
  isFirstStep: boolean;
}

export const WizardNavigation: React.FC<WizardNavigationProps> = ({
  isLastStep,
  isFirstStep,
}) => {
  const {
    previousStep,
    nextStep,
    saveDraft,
    submitTrip,
    canProceed,
  } = useTripWizard();

  const handleNext = () => {
    if (canProceed()) {
      nextStep();
    }
  };

  const handleSubmit = async () => {
    if (canProceed()) {
      await submitTrip();
    }
  };

  const handleSaveDraft = async () => {
    await saveDraft();
  };

  return (
    <div className="flex items-center justify-between border-t pt-4 mt-6">
      <div className="flex items-center gap-2">
        {!isFirstStep && (
          <Button
            type="button"
            variant="outline"
            onClick={previousStep}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={handleSaveDraft}
          className="flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          Save Draft
        </Button>
      </div>

      <div>
        {isLastStep ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canProceed()}
            className="flex items-center gap-2"
          >
            <Send className="h-4 w-4" />
            Create Trip
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-2"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};