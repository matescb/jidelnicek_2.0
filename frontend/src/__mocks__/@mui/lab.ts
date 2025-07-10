import React from 'react';

// Mock implementations for @mui/lab components
export const Timeline = ({ children, ...props }: any) => 
  React.createElement('div', { 'data-testid': 'timeline', ...props }, children);

export const TimelineItem = ({ children, ...props }: any) => 
  React.createElement('div', { 'data-testid': 'timeline-item', ...props }, children);

export const TimelineSeparator = ({ children, ...props }: any) => 
  React.createElement('div', { 'data-testid': 'timeline-separator', ...props }, children);

export const TimelineConnector = (props: any) => 
  React.createElement('div', { 'data-testid': 'timeline-connector', ...props });

export const TimelineContent = ({ children, ...props }: any) => 
  React.createElement('div', { 'data-testid': 'timeline-content', ...props }, children);

export const TimelineDot = ({ children, ...props }: any) => 
  React.createElement('div', { 'data-testid': 'timeline-dot', ...props }, children);

export const TimelineOppositeContent = ({ children, ...props }: any) => 
  React.createElement('div', { 'data-testid': 'timeline-opposite-content', ...props }, children);

// Add other @mui/lab components as needed
export const LoadingButton = ({ children, loading, ...props }: any) => 
  React.createElement('button', { 'data-testid': 'loading-button', disabled: loading, ...props }, 
    loading ? 'Loading...' : children);

export const DatePicker = (props: any) => 
  React.createElement('input', { 'data-testid': 'date-picker', type: 'date', ...props });

export const TimePicker = (props: any) => 
  React.createElement('input', { 'data-testid': 'time-picker', type: 'time', ...props });

export const LocalizationProvider = ({ children }: any) => children;