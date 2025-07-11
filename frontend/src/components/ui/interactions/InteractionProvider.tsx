import React, { createContext, useContext, useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface InteractionSettings {
  reducedMotion: boolean;
  animationSpeed: number;
  enableHaptics: boolean;
  enableSounds: boolean;
}

interface InteractionContextValue extends InteractionSettings {
  updateSettings: (settings: Partial<InteractionSettings>) => void;
  triggerHaptic: (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => void;
  playSound: (type: 'click' | 'success' | 'error' | 'hover') => void;
}

const InteractionContext = createContext<InteractionContextValue | undefined>(undefined);

interface InteractionProviderProps {
  children: React.ReactNode;
  defaultSettings?: Partial<InteractionSettings>;
}

export const InteractionProvider: React.FC<InteractionProviderProps> = ({
  children,
  defaultSettings = {},
}) => {
  const prefersReducedMotion = useReducedMotion();
  
  const [settings, setSettings] = useState<InteractionSettings>({
    reducedMotion: prefersReducedMotion ?? false,
    animationSpeed: 1,
    enableHaptics: true,
    enableSounds: false,
    ...defaultSettings,
  });

  useEffect(() => {
    // Apply animation speed globally
    document.documentElement.style.setProperty(
      '--animation-speed-multiplier',
      settings.animationSpeed.toString()
    );
  }, [settings.animationSpeed]);

  useEffect(() => {
    // Apply reduced motion preference
    if (settings.reducedMotion) {
      document.documentElement.classList.add('reduce-motion');
    } else {
      document.documentElement.classList.remove('reduce-motion');
    }
  }, [settings.reducedMotion]);

  const updateSettings = (newSettings: Partial<InteractionSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    if (!settings.enableHaptics || !('vibrate' in navigator)) return;

    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 50, 10],
      error: [50, 100, 50],
    };

    navigator.vibrate(patterns[type]);
  };

  const playSound = (type: 'click' | 'success' | 'error' | 'hover') => {
    if (!settings.enableSounds) return;

    // Sound implementation would go here
    // For now, we'll just log the sound type
    console.log(`Playing sound: ${type}`);
  };

  const value: InteractionContextValue = {
    ...settings,
    updateSettings,
    triggerHaptic,
    playSound,
  };

  return (
    <InteractionContext.Provider value={value}>
      {children}
    </InteractionContext.Provider>
  );
};

export const useInteractions = () => {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error('useInteractions must be used within InteractionProvider');
  }
  return context;
};

// Hooks for common interaction patterns
export const useHaptic = () => {
  const { triggerHaptic, enableHaptics } = useInteractions();
  return {
    trigger: enableHaptics ? triggerHaptic : () => {},
    enabled: enableHaptics,
  };
};

export const useSound = () => {
  const { playSound, enableSounds } = useInteractions();
  return {
    play: enableSounds ? playSound : () => {},
    enabled: enableSounds,
  };
};

export const useAnimationSpeed = () => {
  const { animationSpeed } = useInteractions();
  return {
    multiplier: animationSpeed,
    duration: (baseDuration: number) => baseDuration / animationSpeed,
  };
};

// Global styles for reduced motion
const globalStyles = `
  .reduce-motion * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
`;

// Inject global styles
if (typeof window !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.innerHTML = globalStyles;
  document.head.appendChild(styleSheet);
}