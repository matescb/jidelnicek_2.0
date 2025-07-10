import React, { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { ThemeToggle } from '../../components/navigation/ThemeToggle';
import { ThemeToggleAdvanced } from '../../components/navigation/ThemeToggleAdvanced';
import { Container } from '../../components/layout/Container';
import { Stack } from '../../components/layout/Stack';
import { Grid } from '../../components/layout/Grid';
import { FormInput } from '../../components/forms/FormInput';
import { FormButton } from '../../components/forms/FormButton';
import { useToast } from '../../hooks/useToast';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  InformationCircleIcon,
  XCircleIcon,
  ClipboardIcon,
  SunIcon,
  MoonIcon,
  BeakerIcon,
  SwatchIcon,
  CubeIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';

// Helper component to display color swatches
const ColorSwatch: React.FC<{ 
  color: string; 
  label: string; 
  textColor?: string;
  showContrast?: boolean;
}> = ({ color, label, textColor = 'text-white', showContrast = false }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    // Extract the actual color value from the Tailwind class
    const colorValue = getComputedStyle(document.documentElement)
      .getPropertyValue(`--color-${color.replace('bg-', '').replace('text-', '')}`)
      .trim();
    
    try {
      await navigator.clipboard.writeText(colorValue || color);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="relative group">
      <div 
        className={`${color} p-6 rounded-lg cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg`}
        onClick={handleCopy}
      >
        <p className={`${textColor} text-sm font-medium`}>{label}</p>
        <p className={`${textColor} text-xs opacity-75 mt-1`}>{color}</p>
        {showContrast && (
          <p className={`${textColor} text-xs opacity-75 mt-1`}>
            Contrast: AA
          </p>
        )}
      </div>
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${copied ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-green-500 text-white px-3 py-1 rounded-md text-sm font-medium shadow-lg">
          Copied!
        </div>
      </div>
      <ClipboardIcon className="absolute top-2 right-2 w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
    </div>
  );
};

// Section header component
const SectionHeader: React.FC<{ title: string; icon?: React.ReactNode }> = ({ title, icon }) => (
  <div className="flex items-center gap-3 mb-6">
    {icon}
    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
  </div>
);

export const ThemeShowcasePage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [selectValue, setSelectValue] = useState('');
  const [loading, setLoading] = useState(false);

  const showToastExample = (type: 'success' | 'error' | 'warning' | 'info') => {
    const messages = {
      success: 'This is a success toast message!',
      error: 'This is an error toast message!',
      warning: 'This is a warning toast message!',
      info: 'This is an info toast message!'
    };
    toast({ title: messages[type], variant: type === 'info' ? 'default' : type });
  };

  return (
    <Container className="py-8">
      <Stack spacing="lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Theme Showcase
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Comprehensive display of all theme components and colors
          </p>
          <div className="flex justify-center gap-4 mt-6">
            <ThemeToggle />
            <ThemeToggleAdvanced />
          </div>
        </div>

        {/* Color Palettes */}
        <section>
          <SectionHeader title="Color Palettes" icon={<SwatchIcon className="w-6 h-6 text-primary-500" />} />
          
          {/* Primary Colors */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Primary</h3>
            <Grid cols={{ base: 2, sm: 3, md: 5, lg: 10 }} gap="md">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                <ColorSwatch
                  key={shade}
                  color={`bg-primary-${shade}`}
                  label={`${shade}`}
                  textColor={shade < 500 ? 'text-gray-900' : 'text-white'}
                />
              ))}
            </Grid>
          </div>

          {/* Secondary Colors */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Secondary</h3>
            <Grid cols={{ base: 2, sm: 3, md: 5, lg: 10 }} gap="md">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                <ColorSwatch
                  key={shade}
                  color={`bg-secondary-${shade}`}
                  label={`${shade}`}
                  textColor={shade < 500 ? 'text-gray-900' : 'text-white'}
                />
              ))}
            </Grid>
          </div>

          {/* Status Colors */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status Colors</h3>
            <Grid cols={{ base: 1, sm: 2, md: 4 }} gap="md">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Success</h4>
                <Grid cols={3} gap="sm">
                  {[400, 500, 600].map((shade) => (
                    <ColorSwatch
                      key={shade}
                      color={`bg-green-${shade}`}
                      label={`${shade}`}
                      textColor="text-white"
                    />
                  ))}
                </Grid>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Warning</h4>
                <Grid cols={3} gap="sm">
                  {[400, 500, 600].map((shade) => (
                    <ColorSwatch
                      key={shade}
                      color={`bg-yellow-${shade}`}
                      label={`${shade}`}
                      textColor={shade === 400 ? 'text-gray-900' : 'text-white'}
                    />
                  ))}
                </Grid>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Error</h4>
                <Grid cols={3} gap="sm">
                  {[400, 500, 600].map((shade) => (
                    <ColorSwatch
                      key={shade}
                      color={`bg-red-${shade}`}
                      label={`${shade}`}
                      textColor="text-white"
                    />
                  ))}
                </Grid>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Info</h4>
                <Grid cols={3} gap="sm">
                  {[400, 500, 600].map((shade) => (
                    <ColorSwatch
                      key={shade}
                      color={`bg-blue-${shade}`}
                      label={`${shade}`}
                      textColor="text-white"
                    />
                  ))}
                </Grid>
              </div>
            </Grid>
          </div>

          {/* Neutral Colors */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Neutral / Gray</h3>
            <Grid cols={{ base: 2, sm: 3, md: 5, lg: 10 }} gap="md">
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                <ColorSwatch
                  key={shade}
                  color={`bg-gray-${shade}`}
                  label={`${shade}`}
                  textColor={shade < 500 ? 'text-gray-900' : 'text-white'}
                />
              ))}
            </Grid>
          </div>
        </section>

        {/* Background and Surface Colors */}
        <section>
          <SectionHeader title="Backgrounds & Surfaces" icon={<CubeIcon className="w-6 h-6 text-primary-500" />} />
          <Grid cols={{ base: 1, sm: 2, md: 3 }} gap="md">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Background</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Main background color</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Surface</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Card and panel background</p>
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Surface Variant</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Alternative surface color</p>
            </div>
          </Grid>
        </section>

        {/* Typography */}
        <section>
          <SectionHeader title="Typography" icon={<BeakerIcon className="w-6 h-6 text-primary-500" />} />
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Heading 1</h1>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Heading 2</h2>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Heading 3</h3>
              <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Heading 4</h4>
              <h5 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Heading 5</h5>
              <h6 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Heading 6</h6>
              
              <p className="text-gray-900 dark:text-white mb-2">
                Primary text color - Used for main content and important information.
              </p>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                Secondary text color - Used for supporting content and descriptions.
              </p>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Muted text color - Used for less important information and hints.
              </p>
              <p className="text-gray-500 dark:text-gray-500 mb-2">
                Disabled text color - Used for disabled states and placeholders.
              </p>
              
              <div className="mt-4 space-y-2">
                <p className="text-primary-600 dark:text-primary-400">Primary colored text</p>
                <p className="text-secondary-600 dark:text-secondary-400">Secondary colored text</p>
                <p className="text-green-600 dark:text-green-400">Success colored text</p>
                <p className="text-yellow-600 dark:text-yellow-400">Warning colored text</p>
                <p className="text-red-600 dark:text-red-400">Error colored text</p>
                <p className="text-blue-600 dark:text-blue-400">Info colored text</p>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section>
          <SectionHeader title="Buttons" icon={<SparklesIcon className="w-6 h-6 text-primary-500" />} />
          <div className="space-y-6">
            {/* Button Variants */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Button Variants</h3>
              <div className="flex flex-wrap gap-4">
                <FormButton variant="primary">Primary Button</FormButton>
                <FormButton variant="secondary">Secondary Button</FormButton>
                <FormButton variant="success">Success Button</FormButton>
                <FormButton variant="warning">Warning Button</FormButton>
                <FormButton variant="danger">Danger Button</FormButton>
                <FormButton variant="ghost">Ghost Button</FormButton>
                <FormButton variant="link">Link Button</FormButton>
              </div>
            </div>

            {/* Button Sizes */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Button Sizes</h3>
              <div className="flex flex-wrap items-center gap-4">
                <FormButton size="sm">Small</FormButton>
                <FormButton size="md">Medium</FormButton>
                <FormButton size="lg">Large</FormButton>
              </div>
            </div>

            {/* Button States */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Button States</h3>
              <div className="flex flex-wrap gap-4">
                <FormButton>Normal</FormButton>
                <FormButton disabled>Disabled</FormButton>
                <FormButton isLoading>Loading</FormButton>
                <FormButton fullWidth>Full Width Button</FormButton>
              </div>
            </div>

            {/* Icon Buttons */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Icon Buttons</h3>
              <div className="flex flex-wrap gap-4">
                <FormButton variant="primary" size="sm">
                  <SunIcon className="w-4 h-4 mr-2" />
                  With Icon
                </FormButton>
                <FormButton variant="secondary">
                  <MoonIcon className="w-5 h-5 mr-2" />
                  Icon Left
                </FormButton>
                <FormButton variant="success">
                  Success
                  <CheckCircleIcon className="w-5 h-5 ml-2" />
                </FormButton>
              </div>
            </div>
          </div>
        </section>

        {/* Form Components */}
        <section>
          <SectionHeader title="Form Components" icon={<ClipboardIcon className="w-6 h-6 text-primary-500" />} />
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <Grid cols={{ base: 1, md: 2 }} gap="md">
              {/* Text Inputs */}
              <div className="space-y-4">
                <FormInput
                  label="Text Input"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Enter some text..."
                />
                <FormInput
                  label="Required Input"
                  value=""
                  onChange={() => {}}
                  required
                  placeholder="This field is required"
                />
                <FormInput
                  label="Disabled Input"
                  value="Disabled value"
                  onChange={() => {}}
                  disabled
                />
                <FormInput
                  label="Input with Error"
                  value=""
                  onChange={() => {}}
                  error="This field has an error"
                />
                <FormInput
                  label="Password Input"
                  type="password"
                  value=""
                  onChange={() => {}}
                  placeholder="Enter password..."
                />
              </div>

              {/* Other Form Elements */}
              <div className="space-y-4">
                {/* Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Input
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    value={selectValue}
                    onChange={(e) => setSelectValue(e.target.value)}
                  >
                    <option value="">Choose an option...</option>
                    <option value="option1">Option 1</option>
                    <option value="option2">Option 2</option>
                    <option value="option3">Option 3</option>
                  </select>
                </div>

                {/* Textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Textarea
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                    placeholder="Enter longer text..."
                  />
                </div>

                {/* Checkbox */}
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                      checked={checkboxChecked}
                      onChange={(e) => setCheckboxChecked(e.target.checked)}
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">Checkbox option</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
                      disabled
                    />
                    <span className="ml-2 text-gray-500">Disabled checkbox</span>
                  </label>
                </div>

                {/* Radio Buttons */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Radio Options
                  </label>
                  {['option1', 'option2', 'option3'].map((option) => (
                    <label key={option} className="flex items-center">
                      <input
                        type="radio"
                        className="h-4 w-4 text-primary-600 border-gray-300 dark:border-gray-600 focus:ring-primary-500"
                        value={option}
                        checked={radioValue === option}
                        onChange={(e) => setRadioValue(e.target.value)}
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">
                        Radio {option.slice(-1)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </Grid>
          </div>
        </section>

        {/* Cards and Elevations */}
        <section>
          <SectionHeader title="Cards & Elevations" icon={<CubeIcon className="w-6 h-6 text-primary-500" />} />
          <Grid cols={{ base: 1, sm: 2, md: 3 }} gap="md">
            {/* Elevation Levels */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Elevation 1</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">shadow-sm</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Elevation 2</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">shadow-md</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Elevation 3</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">shadow-lg</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Elevation 4</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">shadow-xl</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Elevation 5</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">shadow-2xl</p>
            </div>
            <div className="bg-gradient-to-br from-primary-500 to-primary-600 p-6 rounded-lg shadow-lg text-white">
              <h3 className="font-semibold mb-2">Gradient Card</h3>
              <p className="text-sm opacity-90">With gradient background</p>
            </div>
          </Grid>
        </section>

        {/* Alerts and Notifications */}
        <section>
          <SectionHeader title="Alerts & Notifications" icon={<InformationCircleIcon className="w-6 h-6 text-primary-500" />} />
          <Stack spacing="md">
            {/* Alert Examples */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-4 py-3 rounded-lg flex items-start">
              <CheckCircleIcon className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold">Success Alert</h4>
                <p className="text-sm mt-1">Your changes have been saved successfully.</p>
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-300 px-4 py-3 rounded-lg flex items-start">
              <ExclamationTriangleIcon className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold">Warning Alert</h4>
                <p className="text-sm mt-1">Please review your input before proceeding.</p>
              </div>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-lg flex items-start">
              <XCircleIcon className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold">Error Alert</h4>
                <p className="text-sm mt-1">Something went wrong. Please try again.</p>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-4 py-3 rounded-lg flex items-start">
              <InformationCircleIcon className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold">Info Alert</h4>
                <p className="text-sm mt-1">This is some helpful information you should know.</p>
              </div>
            </div>

            {/* Toast Triggers */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Toast Notifications</h3>
              <div className="flex flex-wrap gap-4">
                <FormButton variant="success" onClick={() => showToastExample('success')}>
                  Show Success Toast
                </FormButton>
                <FormButton variant="danger" onClick={() => showToastExample('error')}>
                  Show Error Toast
                </FormButton>
                <FormButton variant="warning" onClick={() => showToastExample('warning')}>
                  Show Warning Toast
                </FormButton>
                <FormButton variant="primary" onClick={() => showToastExample('info')}>
                  Show Info Toast
                </FormButton>
              </div>
            </div>
          </Stack>
        </section>

        {/* Badges and Tags */}
        <section>
          <SectionHeader title="Badges & Tags" icon={<SwatchIcon className="w-6 h-6 text-primary-500" />} />
          <div className="space-y-4">
            {/* Status Badges */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Status Badges</h3>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                  Active
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                  Pending
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                  Expired
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                  Disabled
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  New
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                  Premium
                </span>
              </div>
            </div>

            {/* Category Tags */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Category Tags</h3>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300">
                  Breakfast
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-secondary-100 dark:bg-secondary-900/30 text-secondary-800 dark:text-secondary-300">
                  Lunch
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Dinner
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300">
                  Snack
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-secondary-100 dark:bg-secondary-900/30 text-secondary-800 dark:text-secondary-300">
                  Dessert
                </span>
              </div>
            </div>

            {/* Pill Badges with Icons */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pill Badges with Icons</h3>
              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                  <CheckCircleIcon className="w-4 h-4" />
                  Completed
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                  <ExclamationTriangleIcon className="w-4 h-4" />
                  In Progress
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  <InformationCircleIcon className="w-4 h-4" />
                  Info
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Table Styles */}
        <section>
          <SectionHeader title="Table Styles" icon={<BeakerIcon className="w-6 h-6 text-primary-500" />} />
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    John Doe
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    Admin
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    john@example.com
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    Jane Smith
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      Pending
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    User
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    jane@example.com
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    Bob Johnson
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                      Inactive
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    User
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    bob@example.com
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Loading States */}
        <section>
          <SectionHeader title="Loading States" icon={<SparklesIcon className="w-6 h-6 text-primary-500" />} />
          <Grid cols={{ base: 1, sm: 2, md: 3 }} gap="md">
            {/* Spinner */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Spinner</p>
            </div>

            {/* Pulse */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-3"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              </div>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Skeleton Pulse</p>
            </div>

            {/* Loading Dots */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col items-center">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-3 h-3 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Loading Dots</p>
            </div>
          </Grid>
        </section>

        {/* Borders and Dividers */}
        <section>
          <SectionHeader title="Borders & Dividers" icon={<CubeIcon className="w-6 h-6 text-primary-500" />} />
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Border Styles</h3>
              <div className="space-y-4">
                <div className="p-4 border border-gray-300 dark:border-gray-600 rounded">Default Border</div>
                <div className="p-4 border-2 border-primary-500 rounded">Primary Border</div>
                <div className="p-4 border border-dashed border-gray-400 dark:border-gray-600 rounded">Dashed Border</div>
                <div className="p-4 border border-dotted border-gray-400 dark:border-gray-600 rounded">Dotted Border</div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Dividers</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-700 dark:text-gray-300 mb-2">Horizontal Divider</p>
                  <hr className="border-gray-200 dark:border-gray-700" />
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300 mb-2">Thick Divider</p>
                  <hr className="border-2 border-gray-300 dark:border-gray-600" />
                </div>
                <div>
                  <p className="text-gray-700 dark:text-gray-300 mb-2">Colored Divider</p>
                  <hr className="border-2 border-primary-500" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Theme Transitions */}
        <section>
          <SectionHeader title="Theme Transitions" icon={<SparklesIcon className="w-6 h-6 text-primary-500" />} />
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Toggle between light and dark themes using the controls at the top of the page to see smooth transitions.
              All colors, shadows, and borders adapt to the current theme.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg transition-colors duration-300">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Smooth Transitions</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  All theme changes use CSS transitions for a smooth experience.
                </p>
              </div>
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg transition-colors duration-300">
                <h4 className="font-semibold text-primary-900 dark:text-primary-100 mb-2">Consistent Theming</h4>
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  Every component follows the same theme system.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400">
            Theme System Showcase • Toggle between themes to see all variations
          </p>
        </div>
      </Stack>
    </Container>
  );
};

export default ThemeShowcasePage;