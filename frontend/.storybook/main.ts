import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
    // Note: In Storybook 9, many addons are included in the core
    // The following addons are referenced but may be bundled:
    // - controls (for component props)
    // - viewport (for responsive testing)
    // - backgrounds (for background colors)
    // - toolbars (for custom toolbar items like theme switcher)
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  viteFinal: async (config) => {
    // Customize the Vite config here
    return config;
  },
  features: {
    // Enable features for better theme switching experience
    buildStoriesJson: true,
  },
};

export default config;