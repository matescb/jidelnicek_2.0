// Main components
export { HoverCard } from './HoverCard';
export { ClickRipple } from './ClickRipple';
export { LikeButton } from './LikeButton';
export { ToggleSwitch } from './ToggleSwitch';
export { AnimatedCounter } from './AnimatedCounter';
export { DragHandle } from './DragHandle';
export { FeedbackButton } from './FeedbackButton';

// Provider and hooks
export {
  InteractionProvider,
  useInteractions,
  useHaptic,
  useSound,
  useAnimationSpeed,
} from './InteractionProvider';

// Types
export type { HoverCardProps } from './HoverCard';
export type { ClickRippleProps } from './ClickRipple';
export type { LikeButtonProps } from './LikeButton';
export type { ToggleSwitchProps } from './ToggleSwitch';
export type { AnimatedCounterProps } from './AnimatedCounter';
export type { DragHandleProps } from './DragHandle';
export type { FeedbackButtonProps } from './FeedbackButton';
export type { InteractionProviderProps } from './InteractionProvider';