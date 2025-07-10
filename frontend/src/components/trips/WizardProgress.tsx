import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface WizardProgressProps {
  currentStep: number;
  steps: {
    title: string;
    description: string;
  }[];
}

export const WizardProgress: React.FC<WizardProgressProps> = ({
  currentStep,
  steps,
}) => {
  return (
    <div className="w-full py-4">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute left-0 top-5 h-0.5 w-full bg-gray-200">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{
              width: `${(currentStep / (steps.length - 1)) * 100}%`,
            }}
          />
        </div>

        {/* Steps */}
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isUpcoming = index > currentStep;

          return (
            <div
              key={index}
              className="relative flex flex-col items-center text-center"
            >
              {/* Step Circle */}
              <div
                className={cn(
                  'relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                  {
                    'border-primary bg-primary text-white': isCompleted || isCurrent,
                    'border-gray-300 bg-white text-gray-300': isUpcoming,
                  }
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-semibold">{index + 1}</span>
                )}
              </div>

              {/* Step Label */}
              <div className="mt-2">
                <h3
                  className={cn(
                    'text-sm font-medium transition-colors duration-300',
                    {
                      'text-primary': isCompleted || isCurrent,
                      'text-gray-400': isUpcoming,
                    }
                  )}
                >
                  {step.title}
                </h3>
                <p
                  className={cn(
                    'mt-1 text-xs transition-colors duration-300 hidden sm:block',
                    {
                      'text-gray-600': isCompleted || isCurrent,
                      'text-gray-400': isUpcoming,
                    }
                  )}
                >
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};