import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { addDays, eachDayOfInterval } from 'date-fns';
import {
  TripWizardData,
  TripWizardContextType,
  TripBasicInfo,
  TripParticipant,
  MealSlot,
  DayMealSlots,
} from './TripWizardTypes';

const TripWizardContext = createContext<TripWizardContextType | undefined>(undefined);

export const useTripWizard = () => {
  const context = useContext(TripWizardContext);
  if (!context) {
    throw new Error('useTripWizard must be used within TripWizardProvider');
  }
  return context;
};

interface TripWizardProviderProps {
  children: ReactNode;
  initialData?: Partial<TripWizardData>;
  onComplete?: (data: TripWizardData) => void;
}

export const TripWizardProvider: React.FC<TripWizardProviderProps> = ({
  children,
  initialData,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<TripWizardData>(() => ({
    basicInfo: {
      name: '',
      startDate: new Date(),
      endDate: addDays(new Date(), 2),
      tripType: 'camping',
      ...initialData?.basicInfo,
    },
    participants: initialData?.participants || [],
    mealSlots: initialData?.mealSlots || [
      {
        id: uuidv4(),
        name: 'Breakfast',
        type: 'breakfast',
        defaultTime: '08:00',
      },
      {
        id: uuidv4(),
        name: 'Lunch',
        type: 'lunch',
        defaultTime: '12:30',
      },
      {
        id: uuidv4(),
        name: 'Dinner',
        type: 'dinner',
        defaultTime: '18:30',
      },
    ],
    dayMealSlots: initialData?.dayMealSlots || [],
    isDraft: initialData?.isDraft,
  }));

  const updateBasicInfo = useCallback((info: Partial<TripBasicInfo>) => {
    setData((prev) => ({
      ...prev,
      basicInfo: { ...prev.basicInfo, ...info },
    }));

    // Update dayMealSlots when dates change
    if (info.startDate || info.endDate) {
      setData((prev) => {
        const startDate = info.startDate || prev.basicInfo.startDate;
        const endDate = info.endDate || prev.basicInfo.endDate;
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        
        const newDayMealSlots: DayMealSlots[] = days.map((date) => {
          const existing = prev.dayMealSlots.find(
            (d) => d.date.toDateString() === date.toDateString()
          );
          return (
            existing || {
              date,
              mealSlots: prev.mealSlots.map((slot) => slot.id),
            }
          );
        });

        return { ...prev, dayMealSlots: newDayMealSlots };
      });
    }
  }, []);

  const addParticipant = useCallback((participant: Omit<TripParticipant, 'id'>) => {
    const newParticipant: TripParticipant = {
      ...participant,
      id: uuidv4(),
    };
    setData((prev) => ({
      ...prev,
      participants: [...prev.participants, newParticipant],
    }));
  }, []);

  const updateParticipant = useCallback(
    (id: string, participant: Partial<TripParticipant>) => {
      setData((prev) => ({
        ...prev,
        participants: prev.participants.map((p) =>
          p.id === id ? { ...p, ...participant } : p
        ),
      }));
    },
    []
  );

  const removeParticipant = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      participants: prev.participants.filter((p) => p.id !== id),
    }));
  }, []);

  const addMealSlot = useCallback((slot: Omit<MealSlot, 'id'>) => {
    const newSlot: MealSlot = {
      ...slot,
      id: uuidv4(),
    };
    setData((prev) => {
      // Add new meal slot to all days
      const updatedDayMealSlots = prev.dayMealSlots.map((day) => ({
        ...day,
        mealSlots: [...day.mealSlots, newSlot.id],
      }));

      return {
        ...prev,
        mealSlots: [...prev.mealSlots, newSlot],
        dayMealSlots: updatedDayMealSlots,
      };
    });
  }, []);

  const updateMealSlot = useCallback((id: string, slot: Partial<MealSlot>) => {
    setData((prev) => ({
      ...prev,
      mealSlots: prev.mealSlots.map((s) => (s.id === id ? { ...s, ...slot } : s)),
    }));
  }, []);

  const removeMealSlot = useCallback((id: string) => {
    setData((prev) => {
      // Remove meal slot from all days
      const updatedDayMealSlots = prev.dayMealSlots.map((day) => ({
        ...day,
        mealSlots: day.mealSlots.filter((slotId) => slotId !== id),
      }));

      return {
        ...prev,
        mealSlots: prev.mealSlots.filter((s) => s.id !== id),
        dayMealSlots: updatedDayMealSlots,
      };
    });
  }, []);

  const updateDayMealSlots = useCallback((date: Date, mealSlotIds: string[]) => {
    setData((prev) => ({
      ...prev,
      dayMealSlots: prev.dayMealSlots.map((day) =>
        day.date.toDateString() === date.toDateString()
          ? { ...day, mealSlots: mealSlotIds }
          : day
      ),
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setCurrentStep(Math.max(0, Math.min(step, 3)));
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 3));
  }, []);

  const previousStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const canProceed = useCallback(() => {
    switch (currentStep) {
      case 0: // Basic Info
        return (
          data.basicInfo.name.trim() !== '' &&
          data.basicInfo.startDate <= data.basicInfo.endDate
        );
      case 1: // Participants
        return data.participants.length > 0;
      case 2: // Meal Slots
        return data.mealSlots.length > 0;
      case 3: // Review
        return true;
      default:
        return false;
    }
  }, [currentStep, data]);

  const saveDraft = useCallback(async () => {
    // TODO: Implement API call to save draft
    console.log('Saving draft:', data);
    setData((prev) => ({ ...prev, isDraft: true }));
  }, [data]);

  const submitTrip = useCallback(async () => {
    // TODO: Implement API call to create trip
    console.log('Submitting trip:', data);
    
    // Call onComplete callback if provided
    if (onComplete) {
      onComplete(data);
    }
  }, [data, onComplete]);

  const contextValue: TripWizardContextType = {
    data,
    currentStep,
    updateBasicInfo,
    addParticipant,
    updateParticipant,
    removeParticipant,
    addMealSlot,
    updateMealSlot,
    removeMealSlot,
    updateDayMealSlots,
    goToStep,
    nextStep,
    previousStep,
    saveDraft,
    submitTrip,
    canProceed,
  };

  return (
    <TripWizardContext.Provider value={contextValue}>
      {children}
    </TripWizardContext.Provider>
  );
};