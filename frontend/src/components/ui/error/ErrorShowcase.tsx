import React, { useState } from 'react';
import { 
  ErrorAnimation, 
  BrokenConnectionAnimation,
  ErrorMessage,
  ErrorBoundaryUI,
  ValidationError,
  FieldValidationWrapper,
  ValidationTooltip,
  InlineValidationError,
  NetworkError,
  OfflineDinosaurGame,
  EmptyState
} from './index';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Showcase component demonstrating all error state animations
 * This is for development/documentation purposes
 */
export const ErrorShowcase: React.FC = () => {
  const [showError, setShowError] = useState(true);
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const emailError = touched && !email.includes('@') ? 'Please enter a valid email' : undefined;

  return (
    <div className="space-y-12 p-8">
      <section>
        <h2 className="text-2xl font-bold mb-6">Error Animations</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
          <div className="text-center">
            <ErrorAnimation type="error" size="md" />
            <p className="mt-2 text-sm text-gray-600">Error</p>
          </div>
          <div className="text-center">
            <ErrorAnimation type="warning" size="md" />
            <p className="mt-2 text-sm text-gray-600">Warning</p>
          </div>
          <div className="text-center">
            <ErrorAnimation type="offline" size="md" />
            <p className="mt-2 text-sm text-gray-600">Offline</p>
          </div>
          <div className="text-center">
            <ErrorAnimation type="404" size="md" />
            <p className="mt-2 text-sm text-gray-600">404</p>
          </div>
          <div className="text-center">
            <ErrorAnimation type="glitch" size="md" />
            <p className="mt-2 text-sm text-gray-600">Glitch</p>
          </div>
          <div className="text-center">
            <BrokenConnectionAnimation />
            <p className="mt-2 text-sm text-gray-600">Broken Connection</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Error Messages</h2>
        <div className="space-y-4">
          {showError && (
            <ErrorMessage
              title="Database Connection Failed"
              message="Unable to connect to the database. Please check your connection settings."
              details="Error: ECONNREFUSED 127.0.0.1:5432"
              type="error"
              onDismiss={() => setShowError(false)}
            />
          )}
          <ErrorMessage
            title="Warning: API Rate Limit"
            message="You're approaching the API rate limit. Please slow down your requests."
            type="warning"
          />
          <ErrorMessage
            title="Info: Maintenance Scheduled"
            message="System maintenance is scheduled for tonight at 2 AM UTC."
            type="info"
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Form Validation</h2>
        <div className="max-w-md space-y-4">
          <FieldValidationWrapper error={emailError} touched={touched}>
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          </FieldValidationWrapper>

          <ValidationTooltip error={emailError} touched={touched}>
            <Input
              type="email"
              placeholder="Email with tooltip validation"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
            />
          </ValidationTooltip>

          <InlineValidationError
            errors={[
              'Password must be at least 8 characters',
              'Password must contain a number',
              'Password must contain a special character'
            ]}
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Network Errors</h2>
        <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-8">
          <NetworkError
            onRetry={() => console.log('Retrying...')}
            message="Failed to load recipes. Please check your connection."
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Empty States</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-8">
            <EmptyState
              type="search"
              title="No results found"
              description="We couldn't find any recipes matching your search."
              suggestions={['Pasta', 'Pizza', 'Salad', 'Soup']}
            />
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-8">
            <EmptyState
              type="no-data"
              title="No recipes yet"
              description="Start by creating your first recipe."
              action={{
                label: 'Create Recipe',
                onClick: () => console.log('Create recipe')
              }}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Offline Game</h2>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-8">
          <OfflineDinosaurGame />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-6">Error Boundary</h2>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-4">
            Error Boundary UI would appear when a React error occurs
          </p>
          <div className="transform scale-75 origin-top">
            <ErrorBoundaryUI
              error={new Error('Something went wrong in the component tree')}
              resetError={() => console.log('Reset error')}
              errorInfo={{
                componentStack: `
    in RecipeCard
    in div
    in RecipeList
    in App`
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
};