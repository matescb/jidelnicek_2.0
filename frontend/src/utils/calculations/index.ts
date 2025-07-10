/**
 * Calculation utilities for the Jidelnicek frontend
 * 
 * This module exports all calculation utilities for:
 * - Participant coefficient calculations
 * - Shopping list aggregation and scaling
 * - Nutrition calculations and analysis
 * - Cost estimation and budget tracking
 */

// Re-export all coefficient calculations
export * from './coefficient';

// Re-export all shopping calculations
export * from './shopping';

// Re-export all nutrition calculations
export * from './nutrition';

// Re-export all cost calculations
export * from './cost';

// Common types that might be used across modules
export type { Decimal } from 'decimal.js';