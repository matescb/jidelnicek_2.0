export interface TripBasicInfo {
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  tripType: 'camping' | 'hotel' | 'cottage' | 'other';
}

export interface TripParticipant {
  id: string;
  name: string;
  email?: string;
  dietaryRestrictions?: string[];
  mealCoefficient: number;
  isOrganizer?: boolean;
}

export interface MealSlot {
  id: string;
  name: string;
  defaultTime?: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'custom';
}

export interface DayMealSlots {
  date: Date;
  mealSlots: string[]; // meal slot IDs
}

export interface TripWizardData {
  basicInfo: TripBasicInfo;
  participants: TripParticipant[];
  mealSlots: MealSlot[];
  dayMealSlots: DayMealSlots[];
  isDraft?: boolean;
}

export interface TripWizardContextType {
  data: TripWizardData;
  currentStep: number;
  updateBasicInfo: (info: Partial<TripBasicInfo>) => void;
  addParticipant: (participant: Omit<TripParticipant, 'id'>) => void;
  updateParticipant: (id: string, participant: Partial<TripParticipant>) => void;
  removeParticipant: (id: string) => void;
  addMealSlot: (slot: Omit<MealSlot, 'id'>) => void;
  updateMealSlot: (id: string, slot: Partial<MealSlot>) => void;
  removeMealSlot: (id: string) => void;
  updateDayMealSlots: (date: Date, mealSlotIds: string[]) => void;
  goToStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  saveDraft: () => Promise<void>;
  submitTrip: () => Promise<void>;
  canProceed: () => boolean;
}