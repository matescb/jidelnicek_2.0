import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { BaseStore } from '../types'
import type { Participant } from './tripStore'

// Participant management types
export interface ParticipantTemplate extends Omit<Participant, 'id'> {
  id?: string
  templateName: string
  isDefault?: boolean
}

export interface ParticipantStore extends BaseStore {
  // State
  templates: ParticipantTemplate[]
  templatesLoaded: boolean
  
  // Temporary participant state for forms
  tempParticipants: Participant[]
  
  // Actions
  loadTemplates: () => void
  saveTemplate: (template: ParticipantTemplate) => void
  deleteTemplate: (templateId: string) => void
  setDefaultTemplate: (templateId: string) => void
  
  // Temporary participant management
  addTempParticipant: (participant: Partial<Participant>) => void
  updateTempParticipant: (id: string, updates: Partial<Participant>) => void
  removeTempParticipant: (id: string) => void
  clearTempParticipants: () => void
  setTempParticipants: (participants: Participant[]) => void
  
  // Utility functions
  calculateEffectiveCount: (participants: Participant[], mealType: 'breakfast' | 'lunch' | 'dinner', date: string) => number
  validateParticipants: (participants: Participant[]) => { valid: boolean; errors: string[] }
}

export const useParticipantStore = create<ParticipantStore>()(
  devtools(
    immer((set, get) => ({
      // Initial state
      templates: [],
      templatesLoaded: false,
      tempParticipants: [],
      loading: false,
      error: null,

      // Actions
      clearError: () => set((state) => {
        state.error = null
      }),

      loadTemplates: () => {
        if (get().templatesLoaded) return
        
        // Load from localStorage
        const stored = localStorage.getItem('participant-templates')
        if (stored) {
          try {
            const templates = JSON.parse(stored)
            set((state) => {
              state.templates = templates
              state.templatesLoaded = true
            })
          } catch (error) {
            console.error('Failed to load participant templates:', error)
          }
        } else {
          // Set default templates
          const defaultTemplates: ParticipantTemplate[] = [
            {
              templateName: 'Adult',
              name: '',
              mealCoefficients: { breakfast: 1, lunch: 1, dinner: 1 },
              isDefault: true
            },
            {
              templateName: 'Child (6-12)',
              name: '',
              mealCoefficients: { breakfast: 0.75, lunch: 0.75, dinner: 0.75 }
            },
            {
              templateName: 'Small Child (2-5)',
              name: '',
              mealCoefficients: { breakfast: 0.5, lunch: 0.5, dinner: 0.5 }
            },
            {
              templateName: 'Athlete',
              name: '',
              mealCoefficients: { breakfast: 1.5, lunch: 1.5, dinner: 1.5 }
            },
            {
              templateName: 'Light Eater',
              name: '',
              mealCoefficients: { breakfast: 0.75, lunch: 0.75, dinner: 0.75 }
            }
          ]
          
          set((state) => {
            state.templates = defaultTemplates
            state.templatesLoaded = true
          })
          
          // Save to localStorage
          localStorage.setItem('participant-templates', JSON.stringify(defaultTemplates))
        }
      },

      saveTemplate: (template) => {
        set((state) => {
          const existingIndex = state.templates.findIndex((t: ParticipantTemplate) => t.id === template.id)
          
          if (existingIndex !== -1) {
            state.templates[existingIndex] = template
          } else {
            state.templates.push({ ...template, id: `template-${Date.now()}` })
          }
        })
        
        // Save to localStorage
        localStorage.setItem('participant-templates', JSON.stringify(get().templates))
      },

      deleteTemplate: (templateId) => {
        set((state) => {
          state.templates = state.templates.filter((t: ParticipantTemplate) => t.id !== templateId)
        })
        
        // Save to localStorage
        localStorage.setItem('participant-templates', JSON.stringify(get().templates))
      },

      setDefaultTemplate: (templateId) => {
        set((state) => {
          state.templates.forEach((t: ParticipantTemplate) => {
            t.isDefault = t.id === templateId
          })
        })
        
        // Save to localStorage
        localStorage.setItem('participant-templates', JSON.stringify(get().templates))
      },

      // Temporary participant management
      addTempParticipant: (participant) => {
        const newParticipant: Participant = {
          id: `temp-${Date.now()}`,
          name: participant.name || 'New Participant',
          email: participant.email,
          arrivalDate: participant.arrivalDate,
          departureDate: participant.departureDate,
          mealCoefficients: participant.mealCoefficients || {
            breakfast: 1,
            lunch: 1,
            dinner: 1
          }
        }
        
        set((state) => {
          state.tempParticipants.push(newParticipant)
        })
      },

      updateTempParticipant: (id, updates) => {
        set((state) => {
          const index = state.tempParticipants.findIndex((p: Participant) => p.id === id)
          if (index !== -1) {
            state.tempParticipants[index] = { ...state.tempParticipants[index], ...updates }
          }
        })
      },

      removeTempParticipant: (id) => {
        set((state) => {
          state.tempParticipants = state.tempParticipants.filter((p: Participant) => p.id !== id)
        })
      },

      clearTempParticipants: () => {
        set((state) => {
          state.tempParticipants = []
        })
      },

      setTempParticipants: (participants) => {
        set((state) => {
          state.tempParticipants = participants
        })
      },

      // Utility functions
      calculateEffectiveCount: (participants, mealType, date) => {
        const targetDate = new Date(date)
        
        return participants.reduce((total, participant) => {
          // Check if participant is present on this date
          if (participant.arrivalDate) {
            const arrival = new Date(participant.arrivalDate)
            if (arrival > targetDate) return total
          }
          
          if (participant.departureDate) {
            const departure = new Date(participant.departureDate)
            if (departure < targetDate) return total
          }
          
          // Participant is present, add their coefficient
          return total + (participant.mealCoefficients[mealType] || 1)
        }, 0)
      },

      validateParticipants: (participants) => {
        const errors: string[] = []
        
        if (participants.length === 0) {
          errors.push('At least one participant is required')
        }
        
        if (participants.length > 20) {
          errors.push('Maximum 20 participants allowed')
        }
        
        participants.forEach((p, index) => {
          if (!p.name || p.name.trim() === '') {
            errors.push(`Participant ${index + 1}: Name is required`)
          }
          
          if (p.email && !p.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            errors.push(`Participant ${index + 1}: Invalid email format`)
          }
          
          if (p.arrivalDate && p.departureDate) {
            const arrival = new Date(p.arrivalDate)
            const departure = new Date(p.departureDate)
            if (arrival > departure) {
              errors.push(`Participant ${index + 1}: Arrival date cannot be after departure date`)
            }
          }
          
          const coefficients = p.mealCoefficients
          if (coefficients) {
            Object.entries(coefficients).forEach(([meal, coef]) => {
              if (coef < 0.1 || coef > 3) {
                errors.push(`Participant ${index + 1}: ${meal} coefficient must be between 0.1 and 3`)
              }
            })
          }
        })
        
        return {
          valid: errors.length === 0,
          errors
        }
      }
    })),
    {
      name: 'ParticipantStore'
    }
  )
)